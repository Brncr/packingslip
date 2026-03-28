export function SignatureSection() {
  return (
    <div className="grid grid-cols-2 gap-8 pt-8 border-t">
      <div>
        <p className="text-sm font-medium mb-12">Authorized by Buyer:</p>
        <div className="border-t border-foreground/30 pt-2">
          <p className="text-xs text-muted-foreground">Signature & Date</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Authorized by Supplier:</p>
        <p className="text-sm font-semibold">Shenzhen First Technology Co., Ltd.</p>
        <div className="mt-8 border-t border-foreground/30 pt-2">
          <p className="text-xs text-muted-foreground">Signature & Date</p>
        </div>
      </div>
    </div>
  );
}
