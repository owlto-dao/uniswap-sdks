import { Currency, CurrencyAmount, Fraction, Percent, Price, TradeType, Token } from '@uniswap/sdk-core'
import { IRoute, RouteV2, RouteV3 } from './route'
import { Route as V2RouteSDK, Trade as V2TradeSDK } from '@uniswap/v2-sdk'
import { Route as V3RouteSDK, Trade as V3TradeSDK } from '@uniswap/v3-sdk'
import { ZERO, ONE } from '../constants'
import invariant from 'tiny-invariant'

export class Trade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  public readonly routes: IRoute<TInput, TOutput>[]
  public readonly tradeType: TTradeType
  private _outputAmount: CurrencyAmount<TOutput> | undefined
  private _inputAmount: CurrencyAmount<TInput> | undefined

  /**
   * The swaps of the trade, i.e. which routes and how much is swapped in each that
   * make up the trade. May consist of swaps in v2 or v3.
   */
  public readonly swaps: {
    route: IRoute<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
  }[]

  //  construct a trade across v2 and v3 routes from pre-computed amounts
  public constructor({
    v2Routes,
    v3Routes,
    tradeType,
  }: {
    v2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    v3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }) {
    this.swaps = []
    this.routes = []
    // wrap v2 routes
    for (const { routev2, inputAmount, outputAmount } of v2Routes) {
      const route = new RouteV2(routev2)
      this.routes.push(route)
      this.swaps.push({
        route,
        inputAmount,
        outputAmount,
      })
    }
    // wrap v3 routes
    for (const { routev3, inputAmount, outputAmount } of v3Routes) {
      const route = new RouteV3(routev3)
      this.routes.push(route)
      this.swaps.push({
        route,
        inputAmount,
        outputAmount,
      })
    }

    this.tradeType = tradeType
  }

  public get inputAmount(): CurrencyAmount<TInput> {
    if (this._inputAmount) {
      return this._inputAmount
    }

    const inputCurrency = this.swaps[0].inputAmount.currency
    const totalInputFromRoutes = this.swaps
      .map(({ inputAmount }) => inputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(inputCurrency, 0))

    this._inputAmount = totalInputFromRoutes
    return this._inputAmount
  }

  public get outputAmount(): CurrencyAmount<TOutput> {
    if (this._outputAmount) {
      return this._outputAmount
    }

    const outputCurrency = this.swaps[0].outputAmount.currency
    const totalOutputFromRoutes = this.swaps
      .map(({ outputAmount }) => outputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(outputCurrency, 0))

    this._outputAmount = totalOutputFromRoutes
    return this._outputAmount
  }

  private _executionPrice: Price<TInput, TOutput> | undefined

  /**
   * The price expressed in terms of output amount/input amount.
   */
  public get executionPrice(): Price<TInput, TOutput> {
    return (
      this._executionPrice ??
      (this._executionPrice = new Price(
        this.inputAmount.currency,
        this.outputAmount.currency,
        this.inputAmount.quotient,
        this.outputAmount.quotient
      ))
    )
  }

  /**
   * The cached result of the price impact computation
   * @private
   */
  private _priceImpact: Percent | undefined
  /**
   * Returns the percent difference between the route's mid price and the price impact
   */
  public get priceImpact(): Percent {
    if (this._priceImpact) {
      return this._priceImpact
    }

    let spotOutputAmount = CurrencyAmount.fromRawAmount(this.outputAmount.currency, 0)
    for (const { route, inputAmount } of this.swaps) {
      const midPrice = route.midPrice
      spotOutputAmount = spotOutputAmount.add(midPrice.quote(inputAmount))
    }

    const priceImpact = spotOutputAmount.subtract(this.outputAmount).divide(spotOutputAmount)
    this._priceImpact = new Percent(priceImpact.numerator, priceImpact.denominator)

    return this._priceImpact
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount out
   */
  public minimumAmountOut(slippageTolerance: Percent, amountOut = this.outputAmount): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return amountOut
    } else {
      const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(slippageTolerance)
        .invert()
        .multiply(amountOut.quotient).quotient
      return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
    }
  }

  /**
   * Get the maximum amount in that can be spent via this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount in
   */
  public maximumAmountIn(slippageTolerance: Percent, amountIn = this.inputAmount): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return amountIn
    } else {
      const slippageAdjustedAmountIn = new Fraction(ONE).add(slippageTolerance).multiply(amountIn.quotient).quotient
      return CurrencyAmount.fromRawAmount(amountIn.currency, slippageAdjustedAmountIn)
    }
  }

  /**
   * Return the execution price after accounting for slippage tolerance
   * @param slippageTolerance the allowed tolerated slippage
   * @returns The execution price
   */
  public worstExecutionPrice(slippageTolerance: Percent): Price<TInput, TOutput> {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).quotient,
      this.minimumAmountOut(slippageTolerance).quotient
    )
  }

  public static async fromRoutes<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    v2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[],
    v3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[],
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    const populatedV2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    const populatedV3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    for (const { routev2, amount } of v2Routes) {
      const v2Trade = new V2TradeSDK(routev2, amount, tradeType)
      const inputAmount = v2Trade.inputAmount
      const outputAmount = v2Trade.outputAmount

      populatedV2Routes.push({
        routev2,
        inputAmount,
        outputAmount,
      })
    }

    for (const { routev3, amount } of v3Routes) {
      const v3Trade = V3TradeSDK.fromRoute(routev3, amount, tradeType)
      const inputAmount = (await v3Trade).inputAmount
      const outputAmount = (await v3Trade).outputAmount

      populatedV3Routes.push({
        routev3,
        inputAmount,
        outputAmount,
      })
    }

    return new Trade({
      v2Routes: populatedV2Routes,
      v3Routes: populatedV3Routes,
      tradeType,
    })
  }

  public static async fromRoute<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route: V2RouteSDK<TInput, TOutput> | V3RouteSDK<TInput, TOutput>,
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    let v2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]

    let v3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]

    if (route instanceof V2RouteSDK) {
      const v2Trade = new V2TradeSDK(route, amount, tradeType)
      const inputAmount = v2Trade.inputAmount
      const outputAmount = v2Trade.outputAmount
      v2Routes = [{ routev2: route, inputAmount, outputAmount }]
      v3Routes = []
    } else {
      const v3Trade = V3TradeSDK.fromRoute(route, amount, tradeType)
      const inputAmount = (await v3Trade).inputAmount
      const outputAmount = (await v3Trade).outputAmount
      v3Routes = [{ routev3: route, inputAmount, outputAmount }]
      v2Routes = []
    }
    return new Trade({
      v2Routes,
      v3Routes,
      tradeType
    })
  }
}
