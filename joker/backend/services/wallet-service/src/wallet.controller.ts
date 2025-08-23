import { Request, Response } from 'express';
import { WalletService } from './wallet.service';
import { TransactionType } from '../../../shared/models/transaction.model';

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id;
      const balance = await this.walletService.getBalance(userId);
      res.json({ balance, currency: 'USD' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  }

  async deposit(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id;
      const { amount, paymentMethod, currency = 'USD' } = req.body;
      
      // Validate deposit limits
      const dailyLimit = await this.walletService.getDailyDepositLimit(userId);
      const todayDeposits = await this.walletService.getTodayDeposits(userId);
      
      if (todayDeposits + amount > dailyLimit) {
        return res.status(400).json({ 
          error: 'Daily deposit limit exceeded',
          limit: dailyLimit,
          remaining: dailyLimit - todayDeposits
        });
      }

      const transaction = await this.walletService.processDeposit({
        userId,
        amount,
        currency,
        paymentMethod,
        type: TransactionType.DEPOSIT
      });

      res.json({ 
        success: true, 
        transactionId: transaction.id,
        newBalance: transaction.balanceAfter
      });
    } catch (error) {
      res.status(500).json({ error: 'Deposit failed' });
    }
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id;
      const { amount, withdrawalMethod } = req.body;
      
      // Check KYC status
      const kycStatus = await this.walletService.getKYCStatus(userId);
      if (kycStatus !== 'VERIFIED') {
        return res.status(403).json({ 
          error: 'KYC verification required for withdrawals' 
        });
      }

      const transaction = await this.walletService.processWithdrawal({
        userId,
        amount,
        withdrawalMethod,
        type: TransactionType.WITHDRAWAL
      });

      res.json({ 
        success: true, 
        transactionId: transaction.id,
        estimatedProcessingTime: '1-3 business days'
      });
    } catch (error) {
      res.status(500).json({ error: 'Withdrawal failed' });
    }
  }
}