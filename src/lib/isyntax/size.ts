class Size {
  height: number;
  width: number;

  constructor(height: number, width: number) {
    this.height = height;
    this.width = width;
  }

  clone(): Size {
    const clonedSize = new Size(0, 0);
    clonedSize.height = this.height;
    clonedSize.width = this.width;
    return clonedSize;
  }
}

export { Size };
