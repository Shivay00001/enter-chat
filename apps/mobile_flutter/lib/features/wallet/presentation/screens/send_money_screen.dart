import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/providers/wallet_providers.dart';

class SendMoneyScreen extends ConsumerStatefulWidget {
  final String? initialReceiverId;

  const SendMoneyScreen({super.key, this.initialReceiverId});

  @override
  ConsumerState<SendMoneyScreen> createState() => _SendMoneyScreenState();
}

class _SendMoneyScreenState extends ConsumerState<SendMoneyScreen> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  final _receiverController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialReceiverId != null) {
      _receiverController.text = widget.initialReceiverId!;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    _receiverController.dispose();
    super.dispose();
  }

  Future<void> _sendMoney() async {
    final amountText = _amountController.text.trim();
    final receiverId = _receiverController.text.trim();

    if (amountText.isEmpty || receiverId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter receiver ID and amount')),
      );
      return;
    }

    final amountDouble = double.tryParse(amountText);
    if (amountDouble == null || amountDouble <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid amount')),
      );
      return;
    }

    // Convert to paisa/cents
    final amountInSmallestUnit = (amountDouble * 100).toInt();

    setState(() => _isLoading = true);

    try {
      await ref.read(walletProvider.notifier).sendMoney(
        receiverId: receiverId,
        amount: amountInSmallestUnit,
        note: _noteController.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Money sent successfully!')),
        );
        Navigator.of(context).pop(); // Go back
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Transfer failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Send Money'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.send_to_mobile, size: 64, color: Colors.blue),
            const SizedBox(height: 24),
            TextField(
              controller: _receiverController,
              decoration: const InputDecoration(
                labelText: 'Receiver ID',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
              enabled: widget.initialReceiverId == null,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount',
                prefixIcon: Icon(Icons.currency_rupee),
                border: OutlineInputBorder(),
              ),
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _noteController,
              decoration: const InputDecoration(
                labelText: 'Add a note (optional)',
                prefixIcon: Icon(Icons.note),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: _isLoading ? null : _sendMoney,
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Send Money', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
