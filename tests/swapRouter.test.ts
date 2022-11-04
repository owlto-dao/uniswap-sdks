import { expect } from 'chai'
import { expandTo18DecimalsBN } from '../src/utils/expandTo18Decimals'
import { SwapRouter } from '../src/swapRouter'
import { CurrencyAmount, Currency, Ether } from '@uniswap/sdk-core'
import { FoundationTrade, FoundationData } from '../src/entities/protocols/foundation'
import { NFTXTrade, NFTXData } from '../src/entities/protocols/nftx'
import { looksRareOrders } from './shared/looksRareOrders'
import { LooksRareData, LooksRareTrade, MakerOrder, TakerOrder } from '../src/entities/protocols/looksRare'
import { registerFixture } from './forge/writeInterop'

const ETHER = Ether.onChain(1)
const SAMPLE_ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ROUTER_ADDR = '0x4a873bdd49f7f9cc0a5458416a12973fab208f8d'

describe('SwapRouter', () => {
  describe('Foundation', () => {
    // buyItem from block 15725945
    const foundationData: FoundationData = {
      referrer: '0x459e213D8B5E79d706aB22b945e3aF983d51BC4C', // official foundation referrer
      tokenAddress: '0xEf96021Af16BD04918b0d87cE045d7984ad6c38c',
      tokenId: 32,
      price: expandTo18DecimalsBN(0.01),
      recipient: SAMPLE_ADDR,
    }

    it('encodes a single foundation trade', async () => {
      const foundationTrade = new FoundationTrade([foundationData])
      const methodParameters = SwapRouter.swapGenieCallParameters([foundationTrade])
      registerFixture('_FOUNDATION_BUY_ITEM', methodParameters)
      expect(methodParameters.value).to.eq(foundationData.price.toString())
      expect(methodParameters.calldata).to.eq(
        '0x24856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000000000000000000000000ef96021af16bd04918b0d87ce045d7984ad6c38c00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000084b01ef608000000000000000000000000ef96021af16bd04918b0d87ce045d7984ad6c38c0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000459e213d8b5e79d706ab22b945e3af983d51bc4c00000000000000000000000000000000000000000000000000000000'
      )
    })
  })

  describe('NFTX', () => {
    // buyItems from block 15360000
    const nftxPurchase2Covens: NFTXData = {
      recipient: SAMPLE_ADDR,
      vaultAddress: '0xd89b16331f39ab3878daf395052851d3ac8cf3cd',
      vaultId: 333,
      tokenAddress: '0x5180db8f5c931aae63c74266b211f580155ecac8',
      tokenIds: [584, 3033],
      price: expandTo18DecimalsBN(1),
    }

    it('encodes buying two NFTs from a single NFTX vault', async () => {
      const nftxTrade = new NFTXTrade([nftxPurchase2Covens])
      const methodParameters = SwapRouter.swapGenieCallParameters([nftxTrade])
      registerFixture('_NFTX_BUY_ITEMS', methodParameters)
      expect(methodParameters.value).to.eq(expandTo18DecimalsBN(1).toString())
      expect(methodParameters.calldata).to.eq(
        '0x24856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001647fc82484000000000000000000000000000000000000000000000000000000000000014d000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000002480000000000000000000000000000000000000000000000000000000000000bd90000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000d89b16331f39ab3878daf395052851d3ac8cf3cd00000000000000000000000000000000000000000000000000000000'
      )
    })
  })

  describe('LooksRare', () => {
    const looksRareOrder: MakerOrder = looksRareOrders[0]
    if (looksRareOrder.params == '') looksRareOrder.params = '0x'

    const recipient = SAMPLE_ADDR

    const makerOrder: MakerOrder = looksRareOrder
    const takerOrder: TakerOrder = {
      minPercentageToAsk: looksRareOrder.minPercentageToAsk,
      price: looksRareOrder.price,
      taker: ROUTER_ADDR,
      tokenId: looksRareOrder.tokenId,
      isOrderAsk: false,
      params: looksRareOrder.params,
    }
    const looksRareData: LooksRareData = {
      makerOrder,
      takerOrder,
      recipient,
    }

    it('encodes buying one NFTs from LooksRare', async () => {
      const looksRareTrade = new LooksRareTrade([looksRareData])
      const methodParameters = SwapRouter.swapGenieCallParameters([looksRareTrade])
      registerFixture('_LOOKSRARE_BUY_ITEM', methodParameters)
      expect(methodParameters.value).to.eq(looksRareOrder.price)
      expect(methodParameters.calldata).to.eq(
        '0x24856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000420000000000000000000000000000000000000000000000001bc16d674ec80000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000005180db8f5c931aae63c74266b211f580155ecac800000000000000000000000000000000000000000000000000000000000010eb0000000000000000000000000000000000000000000000000000000000000344b4e4b2960000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004a873bdd49f7f9cc0a5458416a12973fab208f8d000000000000000000000000000000000000000000000001bc16d674ec80000000000000000000000000000000000000000000000000000000000000000010eb000000000000000000000000000000000000000000000000000000000000213400000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000022e86ab483084053562ce713e94431c29d1adb8b0000000000000000000000005180db8f5c931aae63c74266b211f580155ecac8000000000000000000000000000000000000000000000001bc16d674ec80000000000000000000000000000000000000000000000000000000000000000010eb000000000000000000000000000000000000000000000000000000000000000100000000000000000000000056244bb70cbd3ea9dc8007399f61dfc065190031000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000002d000000000000000000000000000000000000000000000000000000006263a334000000000000000000000000000000000000000000000000000000006350e31f00000000000000000000000000000000000000000000000000000000000021340000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001b2d89300623b02e6305d770925d6a34006de07723fd0910a0b1f7780c6964a41b1430768f23a5ad85c14de1a97fcc428fd001944dfcb659fd73f3f70e653e4507000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      )
    })
  })
})
