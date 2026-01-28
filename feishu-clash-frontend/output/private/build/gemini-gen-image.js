"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, "asia-southeast1.run.app"]);
async function callNanoBanana(images, // 从字段捷径传入的图片数组
prompt, aspectRatio, imageSize, apiEndpoint, apiKey, debugLog) {
    if (!images)
        images = [];
    try {
        debugLog({
            '调用 Gemini API 生成图片': {
                '图片数量': images.length,
                '提示词': prompt,
                '宽高比': aspectRatio,
                '图片尺寸': imageSize,
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
            prompt: prompt,
            aspect_ratio: aspectRatio || "1:1",
            image_size: imageSize || "1K",
        };
        if (imageUrls.length > 0) {
            payload.image_urls = imageUrls;
        }
        // 准备请求头 - 添加认证信息
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        };
        // 调用API
        apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/api/generate-image';
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
        debugLog({
            'API响应结果': {
                success: result.success,
                result: result
            }
        });
        return {
            success: true,
            generatedImageUrl: result.image_url,
            filename: result?.filename || `nano-banana-generated-${Date.now()}.png`
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
                'generate': '生成图片',
                'aspectRatio': '图片生成比例',
                'imageSize': '图片生成分辨率',
                'apiEndpoint': 'API调用地址',
                'apiKey': 'API Key',
            },
            'en-US': {
                'image': 'Reference Image',
                'prompt': 'Prompt',
                'generate': 'Generate Image',
                'aspectRatio': 'Image Aspect Ratio',
                'imageSize': 'Image Size',
                'apiEndpoint': 'API Endpoint',
                'apiKey': 'API Key',
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
        {
            key: 'aspectRatio',
            label: t('aspectRatio'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                placeholder: '请选择图片生成比例',
                options: [
                    { value: '1:1', label: '1:1' },
                    { value: '3:2', label: '3:2' },
                    { value: '2:3', label: '2:3' },
                    { value: '4:3', label: '4:3' },
                    { value: '3:4', label: '3:4' },
                    { value: '4:5', label: '4:5' },
                    { value: '5:4', label: '5:4' },
                    { value: '9:16', label: '9:16' },
                    { value: '16:9', label: '16:9' },
                    { value: '21:9', label: '21:9' },
                ],
                defaultValue: '1:1',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'imageSize',
            label: t('imageSize'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                placeholder: '请选择图片生成分辨率',
                options: [
                    { value: '1K', label: '1K' },
                    { value: '2K', label: '2K' },
                    { value: '4K', label: '4K' },
                ],
                defaultValue: '1K',
            },
            validator: {
                required: true,
            }
        }
    ],
    resultType: {
        type: block_basekit_server_api_1.FieldType.Attachment,
    },
    execute: async (formItemParams, context) => {
        const { image = [], prompt = '', aspectRatio = '', imageSize = '', apiEndpoint = '', apiKey = '' } = formItemParams;
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
        debugLog('🚀 开始执行字段捷径 - Gemini图片生成', true);
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
                    message: '请输入图片生成提示词'
                };
            }
            // 调用Gemini API生成图片
            const result = await callNanoBanana(image, prompt, aspectRatio?.value, imageSize?.value, apiEndpoint, apiKey, debugLog);
            if (result.success && result.generatedImageUrl) {
                debugLog(`✅ 图片生成成功，URL: ${result.generatedImageUrl.substring(0, 100)}...`);
                // 返回生成的图片URL
                return {
                    code: block_basekit_server_api_1.FieldCode.Success,
                    data: [{
                            name: result.filename,
                            content: result.generatedImageUrl, // 使用生成的图片URL
                            contentType: 'attachment/url',
                        }]
                };
            }
            else {
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: `${result.error}` || '图片生成失败'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VtaW5pLWdlbi1pbWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9nZW1pbmktZ2VuLWltYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbUZBSStDO0FBQy9DLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxnQ0FBSyxDQUFDO0FBRXBCLE1BQU0sUUFBUSxHQUFHLENBQUMsV0FBVyxFQUFFLGVBQWUsRUFBRSxrQkFBa0IsRUFBRSxlQUFlLENBQUMsQ0FBQztBQUNyRixrQ0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLHlCQUF5QixDQUFDLENBQUMsQ0FBQztBQUdoRSxLQUFLLFVBQVUsY0FBYyxDQUN6QixNQUFhLEVBQUUsZUFBZTtBQUM5QixNQUFjLEVBQ2QsV0FBbUIsRUFDbkIsU0FBaUIsRUFDakIsV0FBbUIsRUFDbkIsTUFBYyxFQUNkLFFBQWtCO0lBT3BCLElBQUksQ0FBQyxNQUFNO1FBQUUsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUN6QixJQUFJLENBQUM7UUFDRCxRQUFRLENBQUM7WUFDUCxvQkFBb0IsRUFBRTtnQkFDbEIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO2dCQUNyQixLQUFLLEVBQUUsTUFBTTtnQkFDYixLQUFLLEVBQUUsV0FBVztnQkFDbEIsTUFBTSxFQUFFLFNBQVM7Z0JBQ2pCLE9BQU8sRUFBRSxXQUFXO2FBQ3ZCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxTQUFTLEdBQWEsRUFBRSxDQUFDO1FBQzdCLHVCQUF1QjtRQUN2QixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxRQUFRLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUNqRCxPQUFPO29CQUNILE9BQU8sRUFB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