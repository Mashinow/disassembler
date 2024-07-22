import { Address, Cell } from '@ton/core';
import { decompile, fromCode, setCodepage } from './disassembler';
import { TonClient } from '@ton/ton';
import { readFile } from 'fs/promises';


export {
    decompile,
    fromCode,
    setCodepage,
}

async function getContractSource() {
    let client = new TonClient({
        endpoint: 'https://scalable-api.tonwhales.com/jsonRPC'
    });
    try {
        // Чтение Buffer из файла
        const filePath = 'F:/JS_PROJ/disassembler/test_data/smart_bytes.boc';
        const fileBuffer = await readFile(filePath);
        // Преобразование Buffer в Cell и получение исходного кода
        const codeCell = Cell.fromBoc(fileBuffer)[0];
        const source = fromCode(codeCell);

        // Вывод исходного кода (или дальнейшая обработка)
        const fs = require('fs');
        fs.writeFile("F:/JS_PROJ/disassembler/test_data/res_code.txt", source, (err: any) => {
            if (err) {
                console.error('Ошибка при сохранении файла:', err);
                return;
            }
            console.log(`Строка успешно сохранена в файл`);
        });
    } catch (error) {
        console.error('Error reading file or processing contract source:', error);
    }
}

let is_debug=true;
if(is_debug)
{
    getContractSource();
}