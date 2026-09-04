// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — AI Analysis Service (OpenRouter Free Models)
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';

// ─── Config ─────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Free models (rotate if one fails)
const FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'inclusionai/ling-3.0-flash:free',
  'google/gemma-4-26b-a4b-it:free',
];

// ─── Types ──────────────────────────────────────────────────────
export interface TradeContext {
  coin: string;
  action: string;
  price: number;
  motivo: string;
  rsi: number;
  adx: number;
  score: number;
  entryPrice?: number;
  pnl?: string;
  marketRegime?: string;
  indicators?: Record<string, any>;
  timestamp: string;
}

export interface TradeAnalysis {
  summary: string;
  reason: string;
  riskAssessment: string;
  lessons: string[];
  recommendation: string;
  confidence: number; // 0-1
  tags: string[];
}

export interface PortfolioAnalysis {
  overallAssessment: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedActions: string[];
}

// ─── AI Service ─────────────────────────────────────────────────
export class AIService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!OPENROUTER_API_KEY;
    if (this.isConfigured) {
      logger.info('🤖 AI Service initialized (OpenRouter)');
    } else {
      logger.warn('⚠️ AI Service not configured. Set OPENROUTER_API_KEY');
    }
  }

  /**
   * Analyze a single trade with AI
   */
  async analyzeTrade(context: TradeContext): Promise<TradeAnalysis> {
    if (!this.isConfigured) {
      return this.fallbackAnalysis(context);
    }

    const prompt = this.buildTradeAnalysisPrompt(context);
    const response = await this.callOpenRouter(prompt);

    return this.parseTradeAnalysis(response);
  }

  /**
   * Analyze overall portfolio performance
   */
  async analyzePortfolio(data: {
    trades: any[];
    winRate: number;
    totalPnl: number;
    coinPerformance: Array<{ coin: string; trades: number; winRate: number; pnl: number }>;
    recentTrades: any[];
  }): Promise<PortfolioAnalysis> {
    if (!this.isConfigured) {
      return this.fallbackPortfolioAnalysis(data);
    }

    const prompt = this.buildPortfolioAnalysisPrompt(data);
    const response = await this.callOpenRouter(prompt);

    return this.parsePortfolioAnalysis(response);
  }

  /**
   * Get AI recommendation for a specific coin
   */
  async getCoinRecommendation(coin: string, data: {
    currentPrice: number;
    indicators: Record<string, number>;
    recentTrades: any[];
    currentPnl?: number;
  }): Promise<string> {
    if (!this.isConfigured) {
      return `Based on available data for ${coin}. Configure OPENROUTER_API_KEY for AI analysis.`;
    }

    const prompt = `As a crypto trading analyst, analyze ${coin} and give a brief recommendation.
    
Current data:
- Price: $${data.currentPrice}
- RSI: ${data.indicators.rsi || 'N/A'}
- ADX: ${data.indicators.adx || 'N/A'}
- Current PnL: ${data.currentPnl ? `${data.currentPnl.toFixed(2)}%` : 'No position'}
- Recent trades: ${data.recentTrades.length}

Provide a 2-3 sentence recommendation. Be concise and actionable.`;

    const response = await this.callOpenRouter(prompt);
    return response.trim();
  }

  // ─── Private: OpenRouter API ──────────────────────────────────

  private async callOpenRouter(prompt: string, maxTokens: number = 1000): Promise<string> {
    let lastError: Error | null = null;

    // Try each free model
    for (const model of FREE_MODELS) {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://el-oraculo.app',
            'X-Title': 'El Oráculo Trading Bot',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert crypto trading analyst. Provide concise, data-driven analysis. Use JSON format when requested.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: maxTokens,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.warn(`AI model ${model} failed: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;

        if (content) {
          return content;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`AI model ${model} error:`, lastError.message);
      }
    }

    // All models failed
    logger.error('All AI models failed:', lastError?.message);
    throw new Error('AI analysis unavailable');
  }

  // ─── Private: Prompts ─────────────────────────────────────────

  private buildTradeAnalysisPrompt(context: TradeContext): string {
    return `Analyze this crypto trade and provide insights in JSON format:

Trade Details:
- Coin: ${context.coin}
- Action: ${context.action}
- Price: $${context.price}
- Reason: ${context.motivo}
- RSI: ${context.rsi}
- ADX: ${context.adx}
- Score: ${context.score}
- Entry Price: ${context.entryPrice ? `$${context.entryPrice}` : 'N/A'}
- PnL: ${context.pnl || 'N/A'}
- Market Regime: ${context.marketRegime || 'N/A'}
- Time: ${context.timestamp}

Respond in this exact JSON format:
{
  "summary": "Brief 1-sentence summary",
  "reason": "Detailed explanation of why this trade was made",
  "riskAssessment": "Risk level and factors",
  "lessons": ["lesson1", "lesson2"],
  "recommendation": "What to do next",
  "confidence": 0.8,
  "tags": ["tag1", "tag2"]
}`;
  }

  private buildPortfolioAnalysisPrompt(data: {
    trades: any[];
    winRate: number;
    totalPnl: number;
    coinPerformance: Array<{ coin: string; trades: number; winRate: number; pnl: number }>;
    recentTrades: any[];
  }): string {
    const performanceSummary = data.coinPerformance
      .map(c => `${c.coin}: ${c.trades} trades, ${c.winRate.toFixed(1)}% win rate, ${c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(2)}% PnL`)
      .join('\n');

    const recentSummary = data.recentTrades
      .slice(0, 5)
      .map(t => `${t.coin} ${t.decision} @ $${t.precio} - ${t.motivo} (${t.pnl || 'N/A'})`)
      .join('\n');

    return `Analyze this trading portfolio and provide insights in JSON format:

Overall Stats:
- Total Trades: ${data.trades.length}
- Win Rate: ${data.winRate.toFixed(1)}%
- Total PnL: ${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl.toFixed(2)}%

Performance by Coin:
${performanceSummary}

Recent Trades:
${recentSummary}

Respond in this exact JSON format:
{
  "overallAssessment": "2-3 sentence overall assessment",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["rec1", "rec2"],
  "riskLevel": "LOW|MEDIUM|HIGH",
  "suggestedActions": ["action1", "action2"]
}`;
  }

  // ─── Private: Parsers ─────────────────────────────────────────

  private parseTradeAnalysis(response: string): TradeAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Trade analyzed',
          reason: parsed.reason || 'Analysis complete',
          riskAssessment: parsed.riskAssessment || 'Medium risk',
          lessons: parsed.lessons || [],
          recommendation: parsed.recommendation || 'Monitor position',
          confidence: parsed.confidence || 0.7,
          tags: parsed.tags || [],
        };
      }
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON:', error);
    }

    // Fallback: use raw response
    return {
      summary: response.slice(0, 200),
      reason: response,
      riskAssessment: 'Analysis provided',
      lessons: [],
      recommendation: 'Review the analysis above',
      confidence: 0.6,
      tags: [],
    };
  }

  private parsePortfolioAnalysis(response: string): PortfolioAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          overallAssessment: parsed.overallAssessment || 'Portfolio analyzed',
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          recommendations: parsed.recommendations || [],
          riskLevel: parsed.riskLevel || 'MEDIUM',
          suggestedActions: parsed.suggestedActions || [],
        };
      }
    } catch (error) {
      logger.warn('Failed to parse portfolio analysis:', error);
    }

    return {
      overallAssessment: response.slice(0, 500),
      strengths: [],
      weaknesses: [],
      recommendations: [],
      riskLevel: 'MEDIUM',
      suggestedActions: [],
    };
  }

  // ─── Fallback (when AI not configured) ────────────────────────

  private fallbackAnalysis(context: TradeContext): TradeAnalysis {
    const isBuy = context.action === 'COMPRAR';
    const hasPosition = context.entryPrice !== undefined && context.entryPrice > 0;

    let summary = `${context.action} signal for ${context.coin}`;
    let reason = `Trade triggered by: ${context.motivo}`;

    if (isBuy) {
      reason += `. RSI at ${context.rsi.toFixed(1)} and ADX at ${context.adx.toFixed(1)} suggest ${context.rsi < 30 ? 'oversold conditions' : context.adx > 25 ? 'trending market' : 'consolidation'}.`;
    } else if (hasPosition && context.pnl) {
      reason += `. Position PnL: ${context.pnl}.`;
    }

    return {
      summary,
      reason,
      riskAssessment: context.rsi > 70 ? 'High (overbought)' : context.rsi < 30 ? 'Low (oversold)' : 'Medium',
      lessons: [
        isBuy ? 'Entry based on scoring threshold' : 'Exit triggered by risk rules',
      ],
      recommendation: isBuy ? 'Monitor for exit signals' : 'Wait for next entry opportunity',
      confidence: 0.5,
      tags: [context.coin.toLowerCase(), isBuy ? 'entry' : 'exit'],
    };
  }

  private fallbackPortfolioAnalysis(data: {
    trades: any[];
    winRate: number;
    totalPnl: number;
    coinPerformance: Array<{ coin: string; trades: number; winRate: number; pnl: number }>;
  }): PortfolioAnalysis {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (data.winRate > 50) strengths.push(`Win rate of ${data.winRate.toFixed(1)}% is above average`);
    if (data.winRate < 40) weaknesses.push(`Win rate of ${data.winRate.toFixed(1)}% needs improvement`);

    if (data.totalPnl > 0) strengths.push(`Positive total PnL of ${data.totalPnl.toFixed(2)}%`);
    if (data.totalPnl < 0) weaknesses.push(`Negative total PnL of ${data.totalPnl.toFixed(2)}%`);

    const bestCoin = data.coinPerformance.reduce((best, c) => c.winRate > best.winRate ? c : best, data.coinPerformance[0]);
    if (bestCoin) strengths.push(`${bestCoin.coin} is the best performer with ${bestCoin.winRate.toFixed(1)}% win rate`);

    return {
      overallAssessment: `Portfolio has ${data.trades.length} trades with ${data.winRate.toFixed(1)}% win rate and ${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl.toFixed(2)}% total PnL.`,
      strengths,
      weaknesses,
      recommendations: [
        'Configure OPENROUTER_API_KEY for AI-powered insights',
        'Review losing trades to identify patterns',
      ],
      riskLevel: data.winRate < 40 ? 'HIGH' : data.winRate > 60 ? 'LOW' : 'MEDIUM',
      suggestedActions: [
        'Continue monitoring performance',
        'Adjust scoring thresholds if win rate is low',
      ],
    };
  }
}

// Export singleton
export const aiService = new AIService();
