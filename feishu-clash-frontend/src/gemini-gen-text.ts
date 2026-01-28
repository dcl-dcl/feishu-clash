import { 
    basekit, FieldType,
    field, FieldComponent,
    FieldCode
 } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
basekit.addDomainList([...feishuDm, "asia-southeast1.run.app"]);


async function callGemini(
  modelId: string,
  thinkingLevel: string,
  images: any[], // 从字段捷径传入的图片数组
  prompt: string,
  apiEndpoint: string,
  apiKey: string,
  debugLog: Function
): Promise<{
    success: boolean;
    text?: string;
    error?: string;
}> {
  if (!images) images = [];
  try {
      debugLog({
        '调用 Gemini API 生成文案': {
          'Model ID': modelId,
          '图片数量': images.length,
          '提示词': prompt,
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
        model: modelId,
        prompt: prompt,
        thinking_level: thinkingLevel,
      };
      if (imageUrls.length > 0) {
        payload.image_urls = imageUrls;
    }
    // debugLog(`paload: ${payload}`)
      // 准备请求头 - 添加认证信息
      const headers: Record<string, string> = {
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

      const result: any = await response.json();
      // debugLog({'API响应结果': { success: result.success, result: result}});
      return {
        success: true,
        text: result.text
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
      key: 'modelId',
      label: t('modelId'),
      component: FieldComponent.SingleSelect,
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
      component: FieldComponent.SingleSelect,
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
  ],
  resultType: {
    type: FieldType.Text,
  },
  execute: async (formItemParams: any, context: any) => {
    const { 
      image = [], modelId = '', thinkingLevel = 'HIGH',
      prompt = '', apiEndpoint = '', apiKey = '',
     } = formItemParams;
    
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
    debugLog('🚀 开始执行字段捷径 - Gemini文字生成', true);

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
          message: '请输入提示词'
        };
      }
      // 调用Gemini 生成文本
      const result = await callGemini(
        modelId.value, thinkingLevel?.value,
        image, prompt, apiEndpoint, apiKey,
        debugLog
      );
      
      if (result.success && result.text) {
        return {
          code: FieldCode.Success,
          data: result.text
        };
        
      } else {
        return {
          code: FieldCode.Error,
          message: `${result.error}`
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