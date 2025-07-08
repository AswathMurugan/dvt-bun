// <stdin>
var RestClient = Java.type("ai.jiffy.apex.utils.RestClient");
var myRestClient = new RestClient();
async function main(sys, input) {
    let __flowState__ = {};
    __flowState__.sys = sys;
    Object.assign(__flowState__, { input });
    const { test } = await z314710696408_1(__flowState__);
    Object.assign(__flowState__, { test });
    const addres = await z614855879883_1(__flowState__);
    __flowState__.addres = addres;
    return __flowState__.test;
}
async function z314710696408_1(__flowState__) {
    const { sys } = __flowState__;
    return d1ih86gehbdqf0gur1hg();
}
function d1ih86gehbdqf0gur1hg() {
    let __messages__ = {}, __varMap__ = {};
    var __temp__exp__ = "";
    try {
        __temp__exp__ = "111";
        var test = 111;
        ;
        return {
            "test": test
        };
    } catch (__temp__except__) {
        __temp__except__ = __temp__except__.message;
        throw "Error : " + __temp__except__ + ". Expression : '" + __temp__exp__ + "'";
    }
    return;
}
async function z614855879883_1(__flowState__) {
    const { sys } = __flowState__;
    const method = "GET";
    const url = /* @__PURE__ */ (() => {
        return "https://newui-checking-sftp.platform-app-integ-test.cluster.jiffy.ai/platform/api/internal/jiffy/defaultInternalService/address";
    })();
    const headers = (() => {
        return {
            "X-Jiffy-Tenant-ID": sys.header["x-jiffy-tenant-id"],
            "X-Jiffy-App-ID": sys.header["x-jiffy-app-id"],
            "X-Jiffy-User-ID": sys.header["x-jiffy-user-id"],
            "Authorization": sys.header["authorization"],
            "X-Jiffy-Target-App-ID": sys.header["x-jiffy-app-id"],
            "X-B3-TraceId": sys.header["x-b3-traceid"],
            "X-B3-ParentSpanId": sys.header["x-b3-spanid"],
            "X-B3-Sampled": sys.header["x-b3-sampled"]
        };
    })();
    let data = "";
    const response = myRestClient.call(method, url, headers, data);
    return JSON.parse(response);
}
export {
    main as default
};
