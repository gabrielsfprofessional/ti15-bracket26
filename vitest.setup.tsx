import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { priority, ...imageProps } = props;
    void priority;
    return (
      // The optimized loader is exercised by the Next build; components only need
      // native image semantics in the deterministic DOM suite.
      // eslint-disable-next-line @next/next/no-img-element
      <img {...imageProps} alt={imageProps.alt ?? ""} />
    );
  },
}));
