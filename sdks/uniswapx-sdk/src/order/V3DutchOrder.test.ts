import { BigNumber, ethers } from "ethers";
import { expect } from "chai";
import { CosignedV3DutchOrder, CosignedV3DutchOrderInfo } from "./V3DutchOrder";

const TIME= 1725379823;
const BLOCK_NUMBER = 20671221;
const RAW_AMOUNT = BigNumber.from("1000000");
const INPUT_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const OUTPUT_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const CHAIN_ID = 1;

const COSIGNER_DATA = {
    decayStartBlock: BLOCK_NUMBER,
    exclusiveFiller: ethers.constants.AddressZero,
    exclusivityOverrideBps: BigNumber.from(0),
    inputOverride: RAW_AMOUNT,
    outputOverrides: [RAW_AMOUNT.mul(102).div(100)]
};

describe("V3DutchOrder", () => {
    it("should get block number", () => {
        expect(BLOCK_NUMBER).to.be.greaterThan(0);
    });

    const getFullOrderInfo = ( data: Partial<CosignedV3DutchOrder>): CosignedV3DutchOrderInfo => {
        return Object.assign(
            {
                reactor: ethers.constants.AddressZero,
                swapper: ethers.constants.AddressZero,
                nonce: BigNumber.from(21),
                deadline: TIME + 1000,
                additionalValidationContract: ethers.constants.AddressZero,
                additionalValidationData: "0x",
                cosigner: ethers.constants.AddressZero,
                cosignerData: COSIGNER_DATA,
                input: {
                    token: INPUT_TOKEN,
                    startAmount: RAW_AMOUNT,
                    curve: {
                        relativeBlocks: [1],
                        relativeAmount: [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4)] // 1e-18, 2e-18, 3e-18, 4e-18
                    },
                    maxAmount: RAW_AMOUNT.add(1)
                },
                outputs: [
                    {
                        token: OUTPUT_TOKEN,
                        startAmount: RAW_AMOUNT,
                        curve: {
                            relativeBlocks: [1],
                            relativeAmount: [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4)] // 1e-18, 2e-18, 3e-18, 4e-18
                        },
                        recipient: ethers.constants.AddressZero,
                    }
                ],
                cosignature: "0x",
                },
                data
            );
    };



    it("Parses a serialized v3 order", () => {
        const orderInfo = getFullOrderInfo({});
        const order = new CosignedV3DutchOrder(orderInfo, CHAIN_ID);
        console.log(order);
        const seralized = order.serialize();
        console.log(seralized);
        const parsed = CosignedV3DutchOrder.parse(seralized, CHAIN_ID);
        expect(parsed.info).to.deep.eq(orderInfo);
    }
    );

});