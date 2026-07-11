import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../application/providers/auth_providers.dart';

/// OTP verification screen with 6-digit input.
/// Connected to Riverpod auth state.
class OtpVerifyScreen extends ConsumerStatefulWidget {
  final String verificationId;

  const OtpVerifyScreen({required this.verificationId, super.key});

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _isLoading = false;
  String? _error;
  int _resendCooldown = 0;

  @override
  void initState() {
    super.initState();
    _focusNodes[0].requestFocus();
  }

  @override
  void dispose() {
    for (final c in _controllers) { c.dispose(); }
    for (final f in _focusNodes) { f.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Listen for auth state changes
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated) {
        context.go(RouteNames.chats);
      }
      if (next.status == AuthStatus.error && next.error != null) {
        setState(() {
          _error = 'Invalid code. Please try again.';
          _isLoading = false;
        });
      }
    });

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              // Lock icon with glow
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.brandPrimary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.lock_outline, size: 32, color: AppColors.brandPrimary),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Verify your number',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit code sent to your phone',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              // OTP input boxes
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (index) {
                  return Container(
                    width: 48,
                    height: 56,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    child: TextFormField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                      decoration: InputDecoration(
                        counterText: '',
                        contentPadding: EdgeInsets.zero,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.brandPrimary, width: 2),
                        ),
                        errorBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.brandDanger, width: 2),
                        ),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: (value) {
                        setState(() => _error = null);
                        if (value.isNotEmpty && index < 5) {
                          _focusNodes[index + 1].requestFocus();
                        }
                        if (value.isEmpty && index > 0) {
                          _focusNodes[index - 1].requestFocus();
                        }
                        _checkComplete();
                      },
                    ),
                  );
                }),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: AppColors.brandDanger, fontSize: 14), textAlign: TextAlign.center),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _onVerify,
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Verify'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: (_isLoading || _resendCooldown > 0) ? null : _onResend,
                child: Text(_resendCooldown > 0 ? 'Resend code in ${_resendCooldown}s' : 'Resend code'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _checkComplete() {
    final otp = _controllers.map((c) => c.text).join();
    if (otp.length == 6) {
      _onVerify();
    }
  }

  Future<void> _onVerify() async {
    final otp = _controllers.map((c) => c.text).join();
    if (otp.length != 6) {
      setState(() => _error = 'Please enter the complete code');
      return;
    }

    setState(() { _isLoading = true; _error = null; });

    await ref.read(authProvider.notifier).verifyOtp(otp: otp);

    // State listener handles navigation on success
    if (mounted && ref.read(authProvider).status == AuthStatus.error) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _onResend() async {
    setState(() => _resendCooldown = 30);
    final authState = ref.read(authProvider);
    if (authState.phone != null) {
      await ref.read(authProvider.notifier).startOtp(channel: 'sms', identifier: authState.phone!);
    }
    // Countdown timer
    for (int i = 30; i > 0; i--) {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) setState(() => _resendCooldown = i - 1);
    }
  }
}
