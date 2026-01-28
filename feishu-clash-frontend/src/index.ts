import { 
    basekit, FieldType,
    field, FieldComponent,
    FieldCode
 } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
basekit.addDomainList([...feishuDm, "asia-southeast1.run.app"]);


async function callNanoBanana(
    images: any[], // 从字段捷径传入的图片数组
    prompt: string,
    aspectRatio: string,
    imageSize: string,
    apiEndpoint: string,
    apiKey: string,
    debugLog: Function
): Promise<{
    success: boolean;
    generatedImageUrl?: string;
    filename?: string;
    error?: string;
}> {
  if (!images) images = [];
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
      let imageUrls: string[] = [];
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
      const payload: any = {
          prompt: prompt,
          aspect_ratio: aspectRatio || "1:1",
          image_size: imageSize || "1K",
      };
      if (imageUrls.length > 0) {
        payload.image_urls = imageUrls;
      }
      // 准备请求头 - 添加认证信息
      const headers: Record<string, string> = {
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

      const result: any = await response.json();
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
      }
        
    } catch (error: any) {
        debugLog(`💥 调用API时发生异常: ${error}`);
        return {
            success: false,
            error: `调用API失败: ${error}`.slice(0, 100)
        };
    }
}

basekit.addField({
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
        component: FieldComponent.Input,
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
        component: FieldComponent.Input,
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
        component: FieldComponent.FieldSelect,
        props: {
            supportType: [FieldType.Attachment],
            multiple: true
        },
        validator: {
            required: false,
        }
    },
    {
        key: 'prompt',
        label: t('prompt'),
        component: FieldComponent.Input,
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
        component: FieldComponent.SingleSelect,
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
        component: FieldComponent.SingleSelect,
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
    type: FieldType.Attachment,
  },
  execute: async (formItemParams: any, context: any) => {
    const { image = [], prompt = '', aspectRatio = '', imageSize = '', apiEndpoint = '', apiKey = '' } = formItemParams;
    
    function debugLog(arg: any, showContext: boolean = false) {
      const timestamp = new Date().toISOString();
      
      if (typeof arg === 'object' && !Array.isArray(arg)) {
        const logData: any = {
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
      } else {
        const logData: any = {
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
          code: FieldCode.Error,
          message: '请输入API调用地址'
        };
      }
      if (!apiKey || apiKey.trim() === '') {
        return {
          code: FieldCode.Error,
          message: '请输入API Key'
        };
      }
      if (!prompt || prompt.trim() === '') {
        return {
          code: FieldCode.Error,
          message: '请输入图片生成提示词'
        };
      }

      // 调用Gemini API生成图片
      const result = await callNanoBanana(
        image, prompt, aspectRatio?.value, imageSize?.value,
        apiEndpoint, apiKey,
        debugLog
      );
      
      if (result.success && result.generatedImageUrl) {
        debugLog(`✅ 图片生成成功，URL: ${result.generatedImageUrl.substring(0, 100)}...`);
        // 返回生成的图片URL
        return {
          code: FieldCode.Success,
          data: [{
            name: result.filename,
            content: result.generatedImageUrl, // 使用生成的图片URL
            contentType: 'attachment/url',
          }]
        };
        
      } else {
        return {
          code: FieldCode.Error,
          message: `${result.error}` || '图片生成失败'
        };
      }
      
    } catch (error) {
        const errorText = `💥 未知错误: ${error}`
        debugLog(errorText);
        return {
            code: FieldCode.Error,
            message: errorText.slice(0, 100)
        };
    }
  }
});

export default basekit;