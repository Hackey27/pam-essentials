const cents=n=>Math.round(Number(n)*100);
const valid=n=>n!==null&&n!==undefined&&n!==""&&Number.isFinite(Number(n));
export function tradePerformance(sales=[]) {
  const summarize=rows=>{
    let revenue=0,cost=0,discount=0,units=0,packsSold=0,boxesSold=0,missingCosts=0,missingTax=0;
    for(const sale of rows) {
      const reverse=sale.saleType==="reversal",sign=reverse?-1:1;
      let tax=0;
      if(sale.taxSnapshot?.enabled){if(!valid(sale.taxSnapshot.tax))missingTax++;else tax=Math.abs(cents(sale.taxSnapshot.tax))*sign;}
      revenue+=cents(sale.total||0)-tax; discount+=cents(sale.discount||0);
      units+=(sale.items||[]).reduce((n,l)=>n+Number(l.quantity||0),0);
      for(const item of sale.items||[]){const p=item.wholesaleSnapshot;if(p?.unitsPerPack>1&&sale.purchaseType==="wholesale"){const n=Number(item.quantity||0)/p.unitsPerPack;if(p.sellingUnit==="box")boxesSold+=n;else if(p.sellingUnit==="pack")packsSold+=n;}}
      if(reverse&&sale.restoreStock===false)continue;
      if(!(sale.items||[]).length){if(valid(sale.cost)&&Number(sale.cost)!==0)cost+=cents(sale.cost);else missingCosts++;continue;}
      for(const item of sale.items){
        const known=item.costRecorded!==false&&(item.costRecorded===true&&(valid(item.lineCost)||valid(item.unitCost))||Math.abs(Number(item.lineCost||item.unitCost||0))>0);
        if(!known)missingCosts++; else cost+=valid(item.lineCost)?cents(item.lineCost):cents(Number(item.unitCost)*Number(item.quantity));
      }
    }
    const netRevenue=missingTax?null:revenue/100,cogs=missingCosts?null:cost/100,grossProfit=missingTax||missingCosts?null:(revenue-cost)/100;
    return {revenue:netRevenue,cogs,grossProfit,marginPct:netRevenue>0&&grossProfit!=null?grossProfit/netRevenue*100:null,markupPct:cogs>0&&grossProfit!=null?grossProfit/cogs*100:null,discounts:discount/100,netUnits:units,packsSold,boxesSold,receipts:rows.filter(s=>s.saleType!=="reversal").length,corrections:rows.filter(s=>s.saleType==="reversal").length,missingCosts,missingTax};
  };
  return {retail:summarize(sales.filter(s=>s.purchaseType!=="wholesale")),wholesale:summarize(sales.filter(s=>s.purchaseType==="wholesale")),combined:summarize(sales)};
}
export function tradePerformanceCsv(report) {
  const row=values=>values.map(v=>{let s=v==null?"":String(v);if(/^[\s]*[=+@]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",");
  const metrics=[["Net revenue (GHS)","revenue"],["Cost of goods sold (GHS)","cogs"],["Gross profit (GHS)","grossProfit"],["Gross margin (%)","marginPct"],["Markup (%)","markupPct"],["Net pieces","netUnits"],["Packs sold","packsSold"],["Boxes sold","boxesSold"],["Receipts","receipts"],["Corrections","corrections"],["Discounts (GHS)","discounts"],["Missing cost records","missingCosts"]];
  return "\uFEFF"+[["PAM Retail & Wholesale performance",report.label||""],["Scope","Recorded POS sales/corrections; no allocation of operating expenses"],["Metric","Retail","Wholesale","Combined"],...metrics.map(([title,key])=>[title,...["retail","wholesale","combined"].map(k=>report[k][key])])].map(row).join("\r\n");
}
