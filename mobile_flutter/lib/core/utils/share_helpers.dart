import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

/// Base URL for the SaveIt web app. Used as the referral landing page.
/// TODO: swap for production domain once universal-links are set up.
const String kReferralBaseUrl = 'https://web-weld-two-36.vercel.app';

/// Shares a referral invitation via the native share sheet.
///
/// - Uses the current `share_plus` (v10+) API, which takes a [ShareParams].
/// - Awaits the platform call so any error surfaces instead of being swallowed.
/// - Passes a [ShareParams.sharePositionOrigin] derived from [context]'s
///   RenderBox — required on iPad, ignored elsewhere. Without it the sheet
///   can silently fail to present on iPadOS.
/// - On error, logs and shows a SnackBar so the user sees that something
///   went wrong instead of an unresponsive button.
Future<void> shareReferralLink(
  BuildContext context, {
  String? referralCode,
}) async {
  final url = referralCode != null && referralCode.isNotEmpty
      ? '$kReferralBaseUrl/join?ref=$referralCode'
      : kReferralBaseUrl;
  final text =
      'Join me on SaveIt — the smart product bookmarking app! $url';

  // Compute the origin rect for the iPad share popover. Safe on iPhone
  // and Android (ignored there).
  Rect? origin;
  final box = context.findRenderObject();
  if (box is RenderBox && box.hasSize) {
    origin = box.localToGlobal(Offset.zero) & box.size;
  }

  try {
    await SharePlus.instance.share(
      ShareParams(
        text: text,
        subject: 'Join me on SaveIt',
        sharePositionOrigin: origin,
      ),
    );
  } catch (e, st) {
    debugPrint('shareReferralLink failed: $e\n$st');
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Could not open share sheet: $e')),
    );
  }
}
