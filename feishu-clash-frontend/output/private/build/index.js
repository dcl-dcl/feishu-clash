"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, "asia-southeast1.run.app"]);
/**
 * 调用封装好的 Gemini API 生成图片
 */
async function callGeminiImageGeneration(images, // 从字段捷径传入的图片数组
prompt, aspectRatio, imageSize, apiEndpoint, apiKey, debugLog) {
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
            const errorText = await response.text();
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
                message: result.message,
                resultData: result.resultData,
            }
        });
        if (result.status !== 'success') {
            return {
                success: false,
                error: result.message || 'API返回状态异常'
            };
        }
        return {
            success: true,
            generatedImageUrl: result.image_url
        };
    }
    catch (error) {
        debugLog(`💥 调用API时发生异常: ${error.message}`);
        return {
            success: false,
            error: `调用API失败: ${error.message}`
        };
    }
}
block_basekit_server_api_1.basekit.addField({
    i18n: {
        messages: {
            'zh-CN': {
                'image': '参考图片',
                'prompt': '生成提示词',
                'generate': '生成图片',
                'aspectRatio': '图片生成比例',
                'imageSize': '图片生成分辨率',
                'apiEndpoint': 'API调用地址',
                'apiKey': 'API Key',
            },
            'en-US': {
                'image': 'Reference Image',
                'prompt': 'Generation Prompt',
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
            debugLog(`🎯 准备生成图片，使用 ${image.length} 张参考图片，提示词: "${prompt}"`);
            // 调用Gemini API生成图片
            const result = await callGeminiImageGeneration(image, prompt, aspectRatio?.value, imageSize?.value, apiEndpoint, apiKey, debugLog);
            if (result.success && result.generatedImageUrl) {
                debugLog(`✅ 图片生成成功，URL: ${result.generatedImageUrl.substring(0, 100)}...`);
                // 返回生成的图片URL
                return {
                    code: block_basekit_server_api_1.FieldCode.Success,
                    data: [{
                            name: `nano-banana-generated-${Date.now()}.png`,
                            content: result.generatedImageUrl, // 使用生成的图片URL
                            contentType: 'attachment/url',
                        }]
                };
            }
            else {
                debugLog(`❌ 图片生成失败: ${result.error}`);
                // 返回错误信息
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    message: `${result.error}` || '图片生成失败'
                };
            }
        }
        catch (error) {
            debugLog({
                '💥 未捕获的异常': {
                    message: error.message,
                    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
                    errorTime: new Date().toISOString()
                }
            });
            return {
                code: block_basekit_server_api_1.FieldCode.Error,
                message: `系统错误: ${error.message}`
            };
        }
    }
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFJK0M7QUFDL0MsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFFcEIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQ3JGLGtDQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDO0FBRWhFOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHlCQUF5QixDQUNwQyxNQUFhLEVBQUUsZUFBZTtBQUM5QixNQUFjLEVBQ2QsV0FBbUIsRUFDbkIsU0FBaUIsRUFDakIsV0FBbUIsRUFDbkIsTUFBYyxFQUNkLFFBQWtCO0lBTXBCLElBQUksQ0FBQztRQUNELFFBQVEsQ0FBQztZQUNQLG9CQUFvQixFQUFFO2dCQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07Z0JBQ3JCLEtBQUssRUFBRSxNQUFNO2dCQUNiLEtBQUssRUFBRSxXQUFXO2dCQUNsQixNQUFNLEVBQUUsU0FBUztnQkFDakIsT0FBTyxFQUFFLFdBQVc7YUFDdkI7U0FDRixDQUFDLENBQUM7UUFDSCxJQUFJLFNBQVMsR0FBYSxFQUFFLENBQUM7UUFDN0IsdUJBQXVCO1FBQ3ZCLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLFFBQVEsQ0FBQywwQkFBMEIsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ2pELE9BQU87b0JBQ0gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsS0FBSyxFQUFFLHdCQUF3QixLQUFLLENBQUMsSUFBSSxFQUFFO2lCQUM5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