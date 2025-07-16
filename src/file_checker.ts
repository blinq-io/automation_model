import fs from "fs"
import path from "path"
import { _commandError, _commandFinally, _preCommand } from "./command_common.js"
import { Types } from "./stable_browser.js"


const checkFileAccess = (filePath: string, accessMode: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fs.access(filePath, accessMode, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    }
    );
}

const getFileName = (filePath: string): string => {
    const platform = process.platform;
    let fileName = "";
    if (platform === "win32") {
        fileName = filePath.split("\\").pop() || "";
    } else {
        fileName = filePath.split("/").pop() || "";
    }
    return fileName;
}


export const verifyFileExists = async (filePath: string, options: any, context: any, world: any)=> {
    //First check if the file exists and is accessible
    if(!options){
        options = {};
    }
    const fileName = getFileName(filePath);
    const state = {
        locate: false,
        scroll: false,
        screenshot: false,
        highlight: false,
        throwError: true,
        operation: "verifyFileExists",
        value: filePath,
        text: `Verify file ${fileName} exists`,
        options,
        type: Types.VERIFY_FILE_EXISTS,
        world
    };
    await _preCommand(state, context.web);
    let fileAccessible = false;
    try {
        fileAccessible = await checkFileAccess(filePath, fs.constants.F_OK);
        if (!fileAccessible) {
            throw new Error(`File ${fileName} does not exist or is not accessible.`);
        }
    }
    catch(err) {
    await _commandError(state, err, context.web);
    }
    finally{
        await _commandFinally(state, context.web);
    }
}
