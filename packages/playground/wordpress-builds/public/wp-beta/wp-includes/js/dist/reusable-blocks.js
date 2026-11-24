(function() {
var wp;
(wp ||= {}).reusableBlocks = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // package-external:@wordpress/data
  var require_data = __commonJS({
    "package-external:@wordpress/data"(exports, module) {
      module.exports = window.wp.data;
    }
  });

  // package-external:@wordpress/deprecated
  var require_deprecated = __commonJS({
    "package-external:@wordpress/deprecated"(exports, module) {
      module.exports = window.wp.deprecated;
    }
  });

  // packages/reusable-blocks/build-module/index.mjs
  var index_exports = {};
  __export(index_exports, {
    ReusableBlocksMenuItems: () => ReusableBlocksMenuItems,
    store: () => store
  });

  // packages/reusable-blocks/build-module/store/index.mjs
  var import_data = __toESM(require_data(), 1);

  // packages/reusable-blocks/build-module/store/actions.mjs
  var actions_exports = {};
  __export(actions_exports, {
    __experimentalConvertBlockToStatic: () => __experimentalConvertBlockToStatic,
    __experimentalConvertBlocksToReusable: () => __experimentalConvertBlocksToReusable,
    __experimentalDeleteReusableBlock: () => __experimentalDeleteReusableBlock,
    __experimentalSetEditingReusableBlock: () => __experimentalSetEditingReusableBlock
  });
  var import_deprecated = __toESM(require_deprecated(), 1);
  var __experimentalConvertBlockToStatic = () => () => {
    (0, import_deprecated.default)(
      "wp.data.dispatch( 'core/reusable-blocks' ).__experimentalConvertBlockToStatic",
      {
        since: "7.1"
      }
    );
  };
  var __experimentalConvertBlocksToReusable = () => async () => {
    (0, import_deprecated.default)(
      "wp.data.dispatch( 'core/reusable-blocks' ).__experimentalConvertBlocksToReusable",
      {
        since: "7.1"
      }
    );
  };
  var __experimentalDeleteReusableBlock = () => async () => {
    (0, import_deprecated.default)(
      "wp.data.dispatch( 'core/reusable-blocks' ).__experimentalDeleteReusableBlock",
      {
        since: "7.1"
      }
    );
  };
  function __experimentalSetEditingReusableBlock(clientId, isEditing) {
    (0, import_deprecated.default)(
      "wp.data.dispatch( 'core/reusable-blocks' ).__experimentalSetEditingReusableBlock",
      {
        since: "7.1"
      }
    );
    return {
      type: "SET_EDITING_REUSABLE_BLOCK",
      clientId,
      isEditing
    };
  }

  // packages/reusable-blocks/build-module/store/reducer.mjs
  var DEFAULT_STATE = {
    isEditingReusableBlock: {}
  };
  function reducer(state = DEFAULT_STATE) {
    return state;
  }

  // packages/reusable-blocks/build-module/store/selectors.mjs
  var selectors_exports = {};
  __export(selectors_exports, {
    __experimentalIsEditingReusableBlock: () => __experimentalIsEditingReusableBlock
  });
  var import_deprecated2 = __toESM(require_deprecated(), 1);
  function __experimentalIsEditingReusableBlock() {
    (0, import_deprecated2.default)(
      "wp.data.select( 'core/reusable-blocks' ).__experimentalIsEditingReusableBlock",
      {
        since: "7.1"
      }
    );
    return false;
  }

  // packages/reusable-blocks/build-module/store/index.mjs
  var STORE_NAME = "core/reusable-blocks";
  var store = (0, import_data.createReduxStore)(STORE_NAME, {
    actions: actions_exports,
    reducer,
    selectors: selectors_exports
  });
  (0, import_data.register)(store);

  // packages/reusable-blocks/build-module/components/reusable-blocks-menu-items/index.mjs
  var import_deprecated3 = __toESM(require_deprecated(), 1);
  function ReusableBlocksMenuItems() {
    (0, import_deprecated3.default)("wp.reusableBlocks.ReusableBlocksMenuItems", {
      since: "7.1"
    });
    return null;
  }
  return __toCommonJS(index_exports);
})();
(window.wp ||= {}).reusableBlocks = wp.reusableBlocks;
})();
