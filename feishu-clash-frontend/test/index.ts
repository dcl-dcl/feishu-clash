import { testField, createFieldContext, FieldContext } from "@lark-opdev/block-basekit-server-api";

async function run() {
    const context = await createFieldContext({
        baseSignature: 'mock-signature'
    });
    testField({
        account: 100,
    }, context as FieldContext);
}

run();
