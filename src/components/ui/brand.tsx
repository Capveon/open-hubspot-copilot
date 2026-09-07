import { appName, productName } from "@/lib/brand-config";
import { CapstoneArch } from "../capstone-arch";

export function Brand({
  product = false,
  size = 22,
}: {
  product?: boolean;
  size?: number;
}) {
  return (
    <>
      <CapstoneArch size={size} />
      <span className="brand__word">{appName()}</span>
      {product ? <span className="brand__product">{productName()}</span> : null}
    </>
  );
}
