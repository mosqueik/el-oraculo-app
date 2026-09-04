// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Exchange Service (Binance)
// ═══════════════════════════════════════════════════════════════════

import { MainClient, AllCoinsInformationResponse, SymbolPrice } from 'binance';
import { logger } from '../../utils/logger';
import { CoinSymbol, BalanceData } from '@el-oraculo/shared';

interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export class ExchangeService {
  private client: MainClient;

  constructor(config: ExchangeConfig) {
    this.client = new MainClient({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    });
  }

  async getBalance(): Promise<BalanceData> {
    try {
      const balances: AllCoinsInformationResponse[] = await this.client.getBalances();
      const result: Record<string, number> = {
        usdt_free: 0,
        usdt_total: 0,
      };

      for (const balance of balances) {
        const free = parseFloat(String(balance.free));
        const locked = parseFloat(String(balance.locked));
        const total = free + locked;

        if (balance.coin === 'USDT') {
          result.usdt_free = free;
          result.usdt_total = total;
        } else if (free > 0) {
          result[`${balance.coin.toLowerCase()}_free`] = free;
          result[`${balance.coin.toLowerCase()}_total`] = total;
        }
      }

      return result as unknown as BalanceData;
    } catch (error) {
      logger.error('Error fetching balance:', error);
      throw error;
    }
  }

  async getTicker(symbol: string): Promise<number> {
    try {
      const ticker: SymbolPrice | SymbolPrice[] = await this.client.getSymbolPriceTicker({ symbol });
      // Handle both single and array response
      const price = Array.isArray(ticker) ? ticker[0]?.price : ticker.price;
      return parseFloat(String(price));
    } catch (error) {
      logger.error(`Error fetching ticker for ${symbol}:`, error);
      throw error;
    }
  }

  async marketBuy(symbol: string, quantity: number): Promise<any> {
    try {
      const result = await this.client.submitNewOrder({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity,
      });
      logger.info(`Market buy ${symbol}: ${quantity} @ market price`);
      return result;
    } catch (error) {
      logger.error(`Market buy error for ${symbol}:`, error);
      throw error;
    }
  }

  async marketSell(symbol: string, quantity: number): Promise<any> {
    try {
      const result = await this.client.submitNewOrder({
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity,
      });
      logger.info(`Market sell ${symbol}: ${quantity} @ market price`);
      return result;
    } catch (error) {
      logger.error(`Market sell error for ${symbol}:`, error);
      throw error;
    }
  }

  async getKlines(symbol: string, interval: string, limit: number): Promise<any[]> {
    try {
      const klines = await this.client.getKlines({
        symbol,
        interval: interval as any,
        limit,
      });
      return klines;
    } catch (error) {
      logger.error(`Error fetching klines for ${symbol}:`, error);
      throw error;
    }
  }
}
