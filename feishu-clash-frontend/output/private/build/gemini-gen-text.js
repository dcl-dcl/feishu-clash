"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, "asia-southeast1.run.app"]);
async function callGemini(modelId, thinkingLevel, images, // 从字段捷径传入的图片数组
prompt, apiEndpoint, apiKey, debugLog) {
    if (!images)
        images = [];
    try {
        debugLog({
            '调用 Gemini API 生成文案': {
                'Model ID': modelId,
                '图片数量': images.length,
                '提示词': prompt,
                'API端点': apiEndpoint,
            }
        });
        let imageUrls = [];
        // 判断是否是图片类型 其他类型 则返回错误
        for (const image of images) {
            if (!image.type.startsWith("image")) {
                debugLog(`❌ 图片类型错误，仅支持图片类型，当前类型: ${image.type}`);
                return {
                    success: false,
                    error: `图片类型错误，仅支持图片类型，当前类型: ${image.type}`
                };
            }
            imageUrls.push(image.tmp_url);
        }
        // 准备参数
        const payload = {
            model: modelId,
            prompt: prompt,
            thinking_level: thinkingLevel,
        };
        if (imageUrls.length > 0) {
            payload.image_urls = imageUrls;
        }
        // debugLog(`paload: ${payload}`)
        // 准备请求头 - 添加认证信息
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        };
        // 调用API
        apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/api/generate-text';
        debugLog(`📤 发送请求到: ${apiEndpoint}`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: headers
        });
        if (!response.ok) {
            const errorText = (await response.text()).slice(0, 100);
            debugLog(`❌ API请求失败: ${response.status} - ${errorText}`);
            return {
                success: false,
                error: `API请求失败: ${response.status} ${errorText}`
            };
        }
        const result = await response.json();
        // debugLog({'API响应结果': { success: result.success, result: result}});
        return {
            success: true,
            text: result.text
        };
    }
    catch (error) {
        debugLog(`💥 调用API时发生异常: ${error}`);
        return {
            success: false,
            error: `调用API失败: ${error}`.slice(0, 100)
        };
    }
}
block_basekit_server_api_1.basekit.addField({
    i18n: {
        messages: {
            'zh-CN': {
                'image': '参考图片',
                'prompt': '提示词',
                'apiEndpoint': 'API调用地址',
                'apiKey': 'API Key',
                'modelId': '模型',
                'thinkingLevel': 'Thinking Level'
            },
            'en-US': {
                'image': 'Reference Image',
                'prompt': 'Prompt',
                'apiEndpoint': 'API Endpoint',
                'apiKey': 'API Key',
                'modelId': 'Model',
                'thinkingLevel': 'Thinking Level'
            }
        }
    },
    formItems: [
        {
            key: 'apiEndpoint',
            label: t('apiEndpoint'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入API调用地址',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'apiKey',
            label: t('apiKey'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入API Key',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'modelId',
            label: t('modelId'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                placeholder: '请选择模型',
                options: [
                    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
                    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
                    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
                    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
                ],
                defaultValue: 'gemini-3-pro-preview',
                validator: {
                    required: true,
                }
            }
        },
        {
            key: 'thinkingLevel',
            label: t('thinkingLevel'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                options: [
                    { value: 'HIGH', label: 'High' },
                    { value: 'LOW', label: 'Low' },
                ],
                defaultValue: 'HIGH',
            }
        },
        {
            key: 'image',
            label: t('image'),
            component: block_basekit_server_api_1.FieldComponent.FieldSelect,
            props: {
                supportType: [block_basekit_server_api_1.FieldType.Attachment],
                multiple: true
            },
            validator: {
                required: false,
            }
        },
        {
            key: 'prompt',
            label: t('prompt'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入图片生成提示词',
            },
            validator: {
                required: true,
            }
        },
    ],
    resultType: {
        type: block_basekit_server_api_1.FieldType.Text,
    },
    execute: async (formItemParams, context) => {
        const { image = [], modelId = '', thinkingLevel = 'HIGH', prompt = '', apiEndpoint = '', apiKey = '', } = formItemParams;
        function debugLog(arg, showContext = false) {
            const timestamp = new Date().toISOString();
            if (typeof arg === 'object' && !Array.isArray(arg)) {
                const logData = {
                    timestamp,
                    logID: context.logID || 'no_log_id',
                    ...arg
                };
                if (showContext) {
                    logData.context = {
                        packID: context.packID,
                        extensionID: context.extensionID,
                        hasTenantKey: !!context.tenantKey,
                        tenantKey: context.tenantKey ? '***' + context.tenantKey.slice(-8) : '无',
                        hasTenantAccessToken: !!context.tenantAccessToken,
                        tenantAccessToken: context.tenantAccessToken ? '***' + context.tenantAccessToken.slice(-8) : '无',
                        hasAppToken: !!context.app?.token,
                        appToken: context.app?.token ? '***' + context.app.token.slice(-8) : '无',
                        disableCredential: context.disableCredential,
                        baseID: context.baseID,
                        tableID: context.tableID,
                        environment: process.env.NODE_ENV || 'unknown'
                    };
                    logData.formItemParams = {
                        imageCount: image.length,
                        promptLength: prompt.length,
                        promptPreview: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt
                    };
                }
                console.log(JSON.stringify(logData, null, 2));
            }
            else {
                const logData = {
                    timestamp,
                    logID: context.logID || 'no_log_id',
                    message: String(arg)
                };
                if (showContext) {
                    logData.context = {
                        packID: context.packID,
                        extensionID: context.extensionID,
                        hasTenantAccessToken: !!context.tenantAccessToken,
                        disableCredential: context.disableCredential
                    };
                }
                console.log(JSON.stringify(logData, null, 2));
            }
        }
        debugLog('🚀 开始执行字段捷径 - Gemini文字生成', true);
        try {
            if (!apiEndpoint || apiEndpoint.trim() === '') {
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: '请输入API调用地址'
                };
            }
            if (!apiKey || apiKey.trim() === '') {
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: '请输入API Key'
                };
            }
            if (!prompt || prompt.trim() === '') {
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: '请输入提示词'
                };
            }
            // 调用Gemini 生成文本
            const result = await callGemini(modelId.value, thinkingLevel?.value, image, prompt, apiEndpoint, apiKey, debugLog);
            if (result.success && result.text) {
                return {
                    code: block_basekit_server_api_1.FieldCode.Success,
                    data: result.text
                };
            }
            else {
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: `${result.error}`
                };
            }
        }
        catch (error) {
            const errorText = `💥 未知错误: ${error}`;
            debugLog(errorText);
            return {
                code: block_basekit_server_api_1.FieldCode.Error,
                message: errorText.slice(0, 100)
            };
        }
    }
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VtaW5pLWdlbi10ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2dlbWluaS1nZW4tdGV4dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1GQUkrQztBQUMvQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUcsZ0NBQUssQ0FBQztBQUVwQixNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDckYsa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7QUFHaEUsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBZSxFQUNmLGFBQXFCLEVBQ3JCLE1BQWEsRUFBRSxlQUFlO0FBQzlCLE1BQWMsRUFDZCxXQUFtQixFQUNuQixNQUFjLEVBQ2QsUUFBa0I7SUFNbEIsSUFBSSxDQUFDLE1BQU07UUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ3pCLElBQUksQ0FBQztRQUNELFFBQVEsQ0FBQztZQUNQLG9CQUFvQixFQUFFO2dCQUNwQixVQUFVLEVBQUUsT0FBTztnQkFDbkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO2dCQUNyQixLQUFLLEVBQUUsTUFBTTtnQkFDYixPQUFPLEVBQUUsV0FBVzthQUNyQjtTQUNGLENBQUMsQ0FBQztRQUNILElBQUksU0FBUyxHQUFhLEVBQUUsQ0FBQztRQUM3Qix1QkFBdUI7UUFDdkIsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUN6QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDbEMsUUFBUSxDQUFDLDBCQUEwQixLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDakQsT0FBTztvQkFDSCxPQUFPLEVBQUUsS0FBSztvQkFDZCxLQUFLLEVBQUUsd0JB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