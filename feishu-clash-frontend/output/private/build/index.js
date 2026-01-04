"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm]);
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
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('aspect_ratio', aspectRatio || "1:1");
        formData.append('image_size', imageSize || "1K");
        if (imageUrls.length > 0) {
            formData.append('image_urls', JSON.stringify(imageUrls));
        }
        // 准备请求头 - 添加认证信息
        const headers = {};
        headers['x-api-key'] = apiKey;
        // 调用API
        apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/api/generate-image';
        debugLog(`📤 发送请求到: ${apiEndpoint}`);
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            body: formData,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFJK0M7QUFDL0MsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFFcEIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQ3JGLGtDQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBRXJDOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHlCQUF5QixDQUNwQyxNQUFhLEVBQUUsZUFBZTtBQUM5QixNQUFjLEVBQ2QsV0FBbUIsRUFDbkIsU0FBaUIsRUFDakIsV0FBbUIsRUFDbkIsTUFBYyxFQUNkLFFBQWtCO0lBTXBCLElBQUksQ0FBQztRQUNELFFBQVEsQ0FBQztZQUNQLG9CQUFvQixFQUFFO2dCQUNsQixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07Z0JBQ3JCLEtBQUssRUFBRSxNQUFNO2dCQUNiLEtBQUssRUFBRSxXQUFXO2dCQUNsQixNQUFNLEVBQUUsU0FBUztnQkFDakIsT0FBTyxFQUFFLFdBQVc7YUFDdkI7U0FDRixDQUFDLENBQUM7UUFDSCxJQUFJLFNBQVMsR0FBYSxFQUFFLENBQUM7UUFDN0IsdUJBQXVCO1FBQ3ZCLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLFFBQVEsQ0FBQywwQkFBMEIsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ2pELE9BQU87b0JBQ0gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsS0FBSyxFQUFFLHdCQUF3QixLQUFLLENBQUMsSUFBSSxFQUFFO2lCQUM5QyxDQUFDO1lBQ04s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