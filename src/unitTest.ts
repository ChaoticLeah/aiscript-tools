import fs from 'fs';

import { OutputChannel } from "vscode";
import { resolveIncludes } from "./multiFileHandler";
//@ts-ignore
import { Parser, Interpreter, utils, values } from '@syuilo/aiscript';

let parser: Parser;
let interpreter: Interpreter;

export async function runUnitTest(file: string, out: OutputChannel) {
    const combinedSource = resolveIncludes(file);
    fs.writeFileSync(file + ".out.is", combinedSource, 'utf8');
    parser = new Parser();
    interpreter = new Interpreter({
        'Test:describe': values.FN_NATIVE(([func]) => {
            //@ts-ignore
            func();
            // utils.assertString(message);
            // alert(message.value);
            return values.NULL;
        }),
        'Test:it': values.FN_NATIVE(([func]) => {
            //@ts-ignore
            func();
            // utils.assertString(message);
            // alert(message.value);
            return values.NULL;
        }),

        'Test:expect': values.FN_NATIVE(([title, value]) => {
            //@ts-ignore
            const instance = values.OBJ(new Map<string, values.Value>([
                ['value', value],
                ['toEqual', values.FN_NATIVE(([def], opts) => {


                    if (JSON.stringify(def) == JSON.stringify(value)) {
                        //@ts-ignore
                        out.appendLine(`[INFO] ✅ Passed ${title.value}`);
                        return values.TRUE;
                    } else {
                        //@ts-ignore
                        out.appendLine(`[ERROR] ❌ ${title.value} Failed.\nGot:${JSON.stringify(value.value)}\nExpected:${JSON.stringify(def.value)}`);
                        // return values.ERROR('test_fail', values.STR(`Failed ${title} test`));
                        return values.FALSE;
                    }
                    // return values.ERROR("Failed Unit Test");
                    // utils.assertObject(def);
                    // const updates = getOptions(def, call);
                    // for (const update of def.value.keys()) {
                    //     if (!Object.hasOwn(updates, update)) continue;
                    //     component.value[update] = updates[update];
                    // }
                })],
            ]));

            return instance;

            // return values.OBJ(utils.jsToVal({
            //     a: 1
            // }));

            // return {

            // }
        }),

    }, {
        out: (value) => {
            out.appendLine(utils.valToJs(value));
        },
        err: (value) => {
            out.appendLine(value.message);
        },
    });

    try {
        const ast = parser.parse(combinedSource);
        await interpreter.exec(ast);

    } catch (error) {
        out.appendLine(error+'');
    }


}