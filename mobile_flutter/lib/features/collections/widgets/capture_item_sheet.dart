import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_theme.dart';

/// Bottom sheet for capturing an item in a physical store: snap photos,
/// collect GPS, have the server vision-enrich the photos into product fields,
/// let the user review/edit, then save.
class CaptureItemSheet extends StatefulWidget {
  final String collectionId;
  final Future<void> Function(Map<String, dynamic> inserted) onSaved;

  const CaptureItemSheet({
    super.key,
    required this.collectionId,
    required this.onSaved,
  });

  @override
  State<CaptureItemSheet> createState() => _CaptureItemSheetState();
}

class _CaptureItemSheetState extends State<CaptureItemSheet> {
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();

  final _title = TextEditingController();
  final _brand = TextEditingController();
  final _price = TextEditingController();
  final _currency = TextEditingController();
  final _size = TextEditingController();
  final _color = TextEditingController();
  final _notes = TextEditingController();
  final _storeName = TextEditingController();
  final _storeAddress = TextEditingController();

  final List<_CapturedPhoto> _photos = [];
  List<Map<String, dynamic>> _classifications = [];
  int _defaultIndex = 0;
  bool _userPickedDefault = false;
  Position? _position;
  bool _enriching = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_title, _brand, _price, _currency, _size, _color, _notes, _storeName, _storeAddress]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _requestLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      setState(() => _position = pos);
      _reverseGeocode(pos);
    } catch (_) {
      // Location is best-effort. User can still type a store name.
    }
  }

  Future<void> _reverseGeocode(Position pos) async {
    final token = _supabase.auth.currentSession?.accessToken;
    try {
      final resp = await _supabase.functions.invoke(
        'reverse-geocode',
        body: {'latitude': pos.latitude, 'longitude': pos.longitude},
        headers: token != null ? {'Authorization': 'Bearer $token'} : null,
      );
      final data = resp.data;
      if (data is Map && mounted) {
        // Only fill if the user hasn't typed anything.
        if (_storeName.text.isEmpty && data['store_name'] != null) {
          _storeName.text = data['store_name'] as String;
        }
        if (_storeAddress.text.isEmpty && data['address'] != null) {
          _storeAddress.text = data['address'] as String;
        }
      }
    } catch (_) {
      // Silent — the store fields remain user-editable.
    }
  }

  Future<void> _pickFromCamera() async {
    final img = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
      maxWidth: 1600,
    );
    if (img == null) return;
    await _addPhotos([img]);
  }

  Future<void> _pickFromGallery() async {
    final imgs = await _picker.pickMultiImage(imageQuality: 80, maxWidth: 1600);
    if (imgs.isEmpty) return;
    await _addPhotos(imgs);
  }

  Future<void> _addPhotos(List<XFile> files) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    // Upload in parallel. Each upload becomes a _CapturedPhoto with its public URL.
    final uploads = files.map((f) => _uploadPhoto(user.id, f)).toList();
    final results = await Future.wait(uploads);

    if (!mounted) return;
    setState(() => _photos.addAll(results.whereType<_CapturedPhoto>()));

    // If this is the first photo, kick off location capture too.
    if (_position == null) {
      _requestLocation();
    }

    // Re-run enrichment whenever the photo set changes.
    _enrichPhotos();
  }

  Future<_CapturedPhoto?> _uploadPhoto(String userId, XFile file) async {
    try {
      final bytes = await file.readAsBytes();
      final ext = file.name.contains('.') ? file.name.split('.').last.toLowerCase() : 'jpg';
      final path = 'captures/$userId/${DateTime.now().millisecondsSinceEpoch}_${file.name}';
      await _supabase.storage.from('item-images').uploadBinary(
            path,
            bytes,
            fileOptions: FileOptions(contentType: _mimeFor(ext), upsert: false),
          );
      final url = _supabase.storage.from('item-images').getPublicUrl(path);
      return _CapturedPhoto(storagePath: path, publicUrl: url, localPath: file.path);
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed: $e');
      return null;
    }
  }

  String _mimeFor(String ext) {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg';
    }
  }

  Future<void> _enrichPhotos() async {
    if (_photos.isEmpty) return;
    setState(() {
      _enriching = true;
      _error = null;
    });

    final token = _supabase.auth.currentSession?.accessToken;
    try {
      final resp = await _supabase.functions.invoke(
        'enrich-item-from-photos',
        body: {'photo_urls': _photos.map((p) => p.publicUrl).toList()},
        headers: token != null ? {'Authorization': 'Bearer $token'} : null,
      );
      final data = resp.data;
      if (data is Map && data['extracted'] is Map) {
        final x = Map<String, dynamic>.from(data['extracted'] as Map);
        if (!mounted) return;
        _applyExtracted(x);
        final raw = x['photo_classifications'];
        if (raw is List) {
          _classifications = raw
              .map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{})
              .toList();
          if (!_userPickedDefault) {
            final i = _classifications.indexWhere((c) => c['kind'] == 'product');
            if (i >= 0 && i < _photos.length) _defaultIndex = i;
          }
        }
      }
    } on FunctionException catch (e) {
      // The edge function returns a structured { user_message, code } body
      // for quota/service errors — surface that instead of the raw exception.
      if (mounted) setState(() => _error = _friendlyEdgeError(e, 'Could not read photos.'));
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not read photos: $e');
    } finally {
      if (mounted) setState(() => _enriching = false);
    }
  }

  String _friendlyEdgeError(FunctionException e, String fallback) {
    final details = e.details;
    if (details is Map) {
      final msg = details['user_message'];
      if (msg is String && msg.isNotEmpty) return msg;
      final err = details['error'];
      if (err is String && err.isNotEmpty) return '$fallback ($err)';
    }
    return fallback;
  }

  // Pre-fills form fields from the vision output without overwriting anything
  // the user has already typed.
  void _applyExtracted(Map<String, dynamic> x) {
    void maybeSet(TextEditingController c, dynamic v) {
      if (c.text.isNotEmpty) return;
      if (v == null) return;
      c.text = v.toString();
    }

    maybeSet(_title, x['title']);
    maybeSet(_brand, x['brand']);
    maybeSet(_price, x['price']);
    maybeSet(_currency, x['currency']);
    maybeSet(_size, x['size']);
    maybeSet(_color, x['color']);
    maybeSet(_notes, x['notes']);
    // Store name from a receipt/tag wins over reverse-geocode only if geocode
    // hasn't filled it yet — otherwise keep geocode (it's usually more accurate).
    if (_storeName.text.isEmpty && x['seller'] != null) {
      _storeName.text = x['seller'].toString();
    }
    setState(() {});
  }

  Future<void> _save() async {
    if (_photos.isEmpty) {
      setState(() => _error = 'Add at least one photo.');
      return;
    }
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final now = DateTime.now().toUtc().toIso8601String();
      final payload = <String, dynamic>{
        'collection_id': widget.collectionId,
        'user_id': user.id,
        'source': 'in_store',
        'enrichment_status': 'completed',
        'photo_urls': _photos.map((p) => p.publicUrl).toList(),
        'image_url': _photos[_defaultIndex.clamp(0, _photos.length - 1)].publicUrl,
        if (_classifications.isNotEmpty) 'photo_classifications': _classifications,
        'captured_at': now,
        'title': _emptyToNull(_title.text),
        'brand': _emptyToNull(_brand.text),
        'price': _emptyToNull(_price.text),
        'currency': _emptyToNull(_currency.text),
        'size': _emptyToNull(_size.text),
        'color': _emptyToNull(_color.text),
        'notes': _emptyToNull(_notes.text),
        'store_name': _emptyToNull(_storeName.text),
        'store_address': _emptyToNull(_storeAddress.text),
        if (_position != null) 'latitude': _position!.latitude,
        if (_position != null) 'longitude': _position!.longitude,
      };

      final inserted = await _supabase.from('items').insert(payload).select().single();
      await widget.onSaved(Map<String, dynamic>.from(inserted));
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = 'Save failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _emptyToNull(String s) => s.trim().isEmpty ? null : s.trim();

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottom),
        child: ListView(
          controller: scrollCtrl,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Capture in store', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Snap the item and any price tags. AI will read the photos and fill in the details.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            _photoStrip(),
            if (_photos.length > 1) ...[
              const SizedBox(height: 6),
              Text(
                'Tap a photo to make it the default image.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondary),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _pickFromCamera,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Camera'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _pickFromGallery,
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Gallery'),
                  ),
                ),
              ],
            ),
            if (_enriching) ...[
              const SizedBox(height: 16),
              const Row(
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  ),
                  SizedBox(width: 10),
                  Text('Reading photos…'),
                ],
              ),
            ],
            const SizedBox(height: 20),
            _sectionLabel('Product'),
            _field(_title, 'Title', autofocus: false),
            _field(_brand, 'Brand'),
            Row(
              children: [
                Expanded(flex: 2, child: _field(_price, 'Price', keyboard: TextInputType.number)),
                const SizedBox(width: 8),
                Expanded(child: _field(_currency, 'Cur')),
              ],
            ),
            Row(
              children: [
                Expanded(child: _field(_size, 'Size')),
                const SizedBox(width: 8),
                Expanded(child: _field(_color, 'Colour')),
              ],
            ),
            _field(_notes, 'Notes', maxLines: 3),
            const SizedBox(height: 12),
            _sectionLabel('Store'),
            _field(_storeName, 'Store name'),
            _field(_storeAddress, 'Address'),
            if (_position != null)
              Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 8),
                child: Text(
                  '📍 ${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving || _photos.isEmpty ? null : _save,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Save Item'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _photoStrip() {
    if (_photos.isEmpty) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: AppTheme.placeholder,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.divider),
        ),
        alignment: Alignment.center,
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.photo_camera_outlined, color: AppTheme.textSecondary),
            SizedBox(height: 6),
            Text('No photos yet', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          ],
        ),
      );
    }
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final p = _photos[i];
          final isDefault = i == _defaultIndex;
          return GestureDetector(
            onTap: () => setState(() {
              _defaultIndex = i;
              _userPickedDefault = true;
            }),
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDefault ? AppTheme.primary : Colors.transparent,
                        width: 3,
                      ),
                    ),
                    child: Image.file(
                      File(p.localPath),
                      width: 120,
                      height: 120,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                if (isDefault)
                  Positioned(
                    left: 4,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Default',
                          style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _photos.removeAt(i);
                      if (i < _classifications.length) _classifications.removeAt(i);
                      if (_defaultIndex >= _photos.length) {
                        _defaultIndex = _photos.isEmpty ? 0 : _photos.length - 1;
                      }
                    }),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close, size: 14, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _sectionLabel(String s) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(s,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: AppTheme.textSecondary,
                  fontWeight: FontWeight.w700,
                )),
      );

  Widget _field(
    TextEditingController c,
    String label, {
    bool autofocus = false,
    int maxLines = 1,
    TextInputType? keyboard,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: c,
        autofocus: autofocus,
        maxLines: maxLines,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}

class _CapturedPhoto {
  final String storagePath;
  final String publicUrl;
  final String localPath;
  _CapturedPhoto({
    required this.storagePath,
    required this.publicUrl,
    required this.localPath,
  });
}
