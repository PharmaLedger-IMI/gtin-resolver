function verifyIfProductMessage(message) {
  return message.messageType === "Product";
}

async function processProductMessage(message) {
  const constants = require("../../constants/constants");
  const schemaUtils = require("../../utils/schemaUtils");
  const logUtils = require("../../utils/logsUtils");
  const ModelMessageService = require('../../services/ModelMessageService');
  const schema = require("./productSchema");
  const productUtils = require("./productUtils")
  this.mappingLogService = logUtils.createInstance(this.storageService, this.options.logService);

  await schemaUtils.validateMessage.bind(this)(message, schema);

  const productCode = message.product.productCode;

  const {
    constDSU,
    productDSU,
    productMetadata,
    alreadyExists
  } = await productUtils.getProductDSU.bind(this)(message, productCode, true);

  /*
  * extension of the file will contain epi version. Used format is epi_+epiVersion;
  * Ex: for version 1 - product.epi_v1
  *  */
  const indication = {product: `${constants.PRODUCT_STORAGE_FILE}${message.messageTypeVersion}`};
  await this.loadJSONS(productDSU, indication);

  if (typeof this.product === "undefined") {
    this.product = JSON.parse(JSON.stringify(productMetadata));
  }

  let modelMsgService = new ModelMessageService("product");
  this.product = {...this.product, ...modelMsgService.getModelFromMessage(message.product)};
  this.product.version = productMetadata.version ? productMetadata.version + 1 : 1;
  this.product.epiProtocol = `v${message.messageTypeVersion}`;

  await this.saveJSONS(productDSU, indication);

  if (!alreadyExists) {
    productDSU.getKeySSIAsString(async (err, keySSI) => {
      if (err) {
        throw new Error("get keySSIAsString from prod DSU failed");
      }
      await constDSU.mount(constants.PRODUCT_DSU_MOUNT_POINT, keySSI);
    })
  }

  this.product.keySSI = await productDSU.getKeySSIAsString();

  await this.mappingLogService.logAndUpdateDb(message, this.product, alreadyExists, constants.LOG_TYPES.PRODUCT)

}

require("opendsu").loadApi("m2dsu").defineMapping(verifyIfProductMessage, processProductMessage);