
import { Size } from './Size';
/**
 * Helper class that deals with image geometry.
 *
 * @requires Size
 */
export class ImageHelper {
  constructor() {
    // Empty constructor
  }

  /**
   * Finds the image dimension for a given level of the image.
   * @param level - Level of the image.
   * @param imageWidth - Full resolution image width.
   * @param imageHeight - Full resolution image height.
   * @returns An array where the first element is the height and the second is the width.
   */
  static findDimension(
    level: number,
    imageWidth: number,
    imageHeight: number
  ): [number, number] {
    const factor = 1 << level;
    const factor_1 = factor - 1;
    return [
      ((imageHeight + factor_1) / factor) >> 0,
      ((imageWidth + factor_1) / factor) >> 0,
    ];
  }

  /**
   * Finds the highest pixel level such that the number of rows or columns
   * at that level are less than or equal to the specified dimension.
   *
   * For example, suppose the full image size is 512 x 1000:
   * - Pixel Level 0: 512 x 1000
   * - Pixel Level 1: 256 x 500
   * - Pixel Level 2: 128 x 250
   *
   * If the input dimension is >= 128 and < 256, this function will return 2.
   *
   * @param dimension - The minimum of rows and columns of the required image size.
   * @param imageWidth - Full resolution image width.
   * @param imageHeight - Full resolution image height.
   * @returns The highest pixel level with resolution less than or equal to the given dimension.
   */
  static findFloorLevel(
    dimension: number,
    imageWidth: number,
    imageHeight: number
  ): number {
    let level = -1;
    let levelDim: [number, number];

    do {
      level++;
      levelDim = this.findDimension(level, imageWidth, imageHeight);
    } while (levelDim[0] > dimension && levelDim[1] > dimension);

    return level;
  }

  /**
   * Same as findFloorLevel, but returns the dimension of the level instead of the level index.
   *
   * @param dimension - The minimum of rows and columns of the required image size.
   * @param imageWidth - Full resolution image width.
   * @param imageHeight - Full resolution image height.
   * @returns An instance of Size representing the dimension of the highest pixel level
   *          with resolution less than or equal to the given dimension.
   */
  static findFloorLevelDimension(
    dimension: number,
    imageWidth: number,
    imageHeight: number
  ): Size {
    const level = this.findFloorLevel(dimension, imageWidth, imageHeight);
    const levelDimension = this.findDimension(level, imageWidth, imageHeight);
    return new Size(levelDimension[0], levelDimension[1]);
  }
}

export default new ImageHelper();
