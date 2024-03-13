import { createReadStream, createWriteStream } from "fs";
import { decodePNGFromStream, encodePNGToStream } from "pureimage";

const drawRectangle = async (
  inputFilePath: string,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  try {
    const img1 = await decodePNGFromStream(createReadStream(inputFilePath));
    const ctx = img1.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(x - 1, y - 1, width + 2, 2);
    ctx.fillRect(x - 1, y - 1, 2, height + 2);
    ctx.fillRect(x - 1, y + height + 1, width + 2, 2);
    ctx.fillRect(x + width + 1, y - 1, 2, height + 2);

    await encodePNGToStream(img1, createWriteStream(inputFilePath));
    console.log("Rectangle drawn successfully", inputFilePath);
  } catch (err) {
    console.error(err);
  }
};
export default drawRectangle;
