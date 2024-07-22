import { beginCell, Cell, Dictionary, DictionaryValue, Slice } from '@ton/core';
import { CP0Auto } from './codepages/cp0.generated';
import { KnownMethods } from './consts/knownMethods';
import { Codepage } from './structs/codepage';
import { _isDebug } from './utils/isDebug';


let codepage: Codepage = CP0Auto

export function setCodepage(cp: Codepage) {
    codepage = cp
}

function bracketIndices(str: string) {
    const stack = [];
    const result = [];
  
    for (let i = str.length; i >= 0; i--) {
      if (str[i] === '}') {
        stack.push(result.push([ i, null ]) - 1);
      } else if (str[i] === '{') {
        if (stack.length) {
          result[stack.pop()!][1] = i;
        } else {
          result.push([ null, i ]);
        }
      }
    }
  
    return result;
  }
  

export function decompile(slice: Slice, indent?: number) {
    let result = '';
    const append = (txt: string | Cell) => {
        if (txt instanceof Cell) {
            result += txt.toString(' '.repeat(indent || 0));
            return;
        }
        if (txt.startsWith("LEFT! ")) {
            if(!indent) return;
            let data = bracketIndices(result);
            const insertionPoint: number = data[0][1]!;
            result = result.slice(0, insertionPoint-2) + txt.slice(6) + result.slice(insertionPoint-2);
        }

        else if (txt.startsWith("IFELSE")) {
            if(!indent) return;
            let data = bracketIndices(result);
           // const sc1: number = data[0][0]!;
            const so1: number = data[0][1]!;
            const sc2: number = data[1][0]!;
            const so2: number = data[1][1]!;
            result = result.slice(0, so2 - 2) + "IF:<{" +
                        result.slice(so2+1, sc2) + 
                        "}>ELSE<{" +
                        result.slice(so1 + 1);
        }
        else {
            if (indent) {
                for (let i = 0; i < indent; i++) result += ' ';
            }
            result += txt + '\n';
        }
    };
    let opCode = ''

    while (slice.remainingBits > 0) {
        let opCodePart = slice.loadBit();
        opCode += opCodePart ? '1' : '0'

        // edit maxOccurencies only for debugging purposes
        let matches = codepage.find(opCode, 2);
        if (matches.length > 1) {
            continue;
        }
        if (matches.length == 1 && opCode.length !== matches[0].length) {
            continue;
        }
        if (matches.length == 0) {
            let fullCell = beginCell();
            for (let bit of Array.from(opCode).map(a => a == '0' ? false : true)) {
                fullCell.storeBit(bit);
            }
            fullCell.storeSlice(slice);
            append(fullCell.asCell());
            continue;
        }

        let op = codepage.getOp(opCode)
        opCode = ''
        if (typeof op === 'string') {
            append(op)
        } else if (typeof op === 'function') {
            let opTxt = op(slice, indent || 0);
            append(opTxt);
        }

        if (slice.remainingBits === 0 && slice.remainingRefs > 0) {
            slice = slice.loadRef().beginParse()
        }
    }
    return result;
}

function createSliceValue(): DictionaryValue<Slice> {
    return {
        serialize: (src, builder) => {
            builder.storeSlice(src);
        },
        parse: (src) => {
            return src;
        }
    };
}

export function decompileMethodsMap(slice: Slice, keyLen: number, indent?: number) {
    let methodsMap = slice.loadDictDirect(Dictionary.Keys.Int(keyLen), createSliceValue());
    let methodsMapDecompiled = new Map<number, string>();
    for (let [key, cs] of methodsMap) {
        try {
            methodsMapDecompiled.set(key, decompile(cs, (indent || 0) + 4));
        } catch (e) {
            _isDebug() && console.error(e);
            methodsMapDecompiled.set(key, cs.asCell().toString(' '.repeat((indent || 0) + 4)));
        }
    }
    let result = '';
    const append = (txt: string) => {
        if (indent) {
            for (let i = 0; i < indent; i++) result += ' ';
        }
        result += txt + '\n';
    };
  //  append('(:methods');
    indent = (indent || 0) + 2;
    let methodNames = [];
    for (let [methodId, code] of methodsMapDecompiled) {
        let methodName = KnownMethods[methodId] ?? null;
        methodNames.push([methodId, methodName]);
        append(`${methodName ?? methodId} PROC:<{\n${code}  }>`);
    }
    result = result.slice(0, -1); // remove trailing newline
    indent -= 2;
    //append(')');
    result = result.slice(0, -1); // remove trailing newline

    let methods = "";

    for (let [methodId, methodName] of methodNames) {
        methods += "  ";
        if (methodName) {
            methodName = String(methodName);
            if (methodName.startsWith("get_")) {
                methods += `${methodId} DECLMETHOD ${methodName}\n`;
            } else {
                methods += `DECLPROC ${methodName}\n`;
            }
        } else {
            methods += `DECLPROC ${methodId}\n`;
        }
    }
    let start_text = "\"Asm.fif\" include\n\nPROGRAM{\n";
    result = start_text + methods + result + ">\n}END>c";
    return result;
}

export function fromCode(cell: Cell) {
    let slice = cell.beginParse()
    let header = slice.loadUint(16)
    if (header !== 0xff00) {
        throw new Error('unsupported codepage');
    }

    let result = '' //'SETCP0\n'
    result += decompile(slice);
    const lines = result.split('\n');
    lines.splice(-3, 3);
    return lines.join('\n');;
}

export function fromBoc(boc: Buffer) {
    let cell = Cell.fromBoc(boc)[0];

    return fromCode(cell);
}