import test from "node:test";
import assert from "node:assert/strict";
import {reportingBounds,selectReportingPeriod,summarizeActivity,activityTrend,stockMetricProducts} from "../lib/adminReporting.mjs";
test("signed corrections net financial totals and units without counting a second receipt",()=>{
 const result=summarizeActivity([{total:19.75,profit:5.1,discount:1,items:[{quantity:3}]},{saleType:"reversal",total:-19.75,profit:-5.1,discount:-1,items:[{quantity:-3}]}],[{amount:1.23}]);
 assert.deepEqual(result,{sales:0,profit:0,expenses:1.23,netProfit:-1.23,discounts:0,transactions:1,reversals:1,unitsSold:0});
});
test("custom dates reject malformed/reversed inputs without throwing",()=>{for(const range of [{start:"2026-99-99",end:"2026-10-14"},{start:"2026-02-30",end:"2026-10-14"},{start:"2026-10-15",end:"2026-10-14"},{}]) assert.equal(selectReportingPeriod([],[],"custom",range).valid,false);});
test("Ghana day boundaries and previous month-to-date clamp at month end",()=>{
 const bounds=reportingBounds("month",{},new Date("2026-03-31T12:30:00Z"));assert.equal(new Date(bounds.previousEnd).toISOString(),"2026-02-28T12:30:00.000Z");
 const report=selectReportingPeriod([{createdAt:"2026-10-13T23:59:59Z",total:10},{createdAt:"2026-10-14T00:00:00Z",total:20}],[],"today",{},new Date("2026-10-14T12:00:00Z"));assert.equal(report.current.sales,20);assert.equal(report.previous.sales,0);
});
test("day buckets fill gaps and expense-only losses remain visible",()=>{
 const report=selectReportingPeriod([{createdAt:"2026-10-12T10:00:00Z",total:20,profit:5}], [{createdAt:"2026-10-14T10:00:00Z",amount:8}],"custom",{start:"2026-10-12",end:"2026-10-14"});const trend=activityTrend(report);
 assert.equal(trend.points.length,3);assert.equal(trend.points[1].sales,0);assert.equal(trend.points[2].netProfit,-8);assert.equal(trend.points.reduce((sum,p)=>sum+p.netProfit,0),report.current.netProfit);
});
test("week and month grouping aggregates the same signed totals",()=>{
 const report=selectReportingPeriod([{createdAt:"2026-10-01T01:00:00Z",total:10,profit:3},{createdAt:"2026-10-07T01:00:00Z",total:-5,profit:-1,saleType:"reversal"}],[],"all",{});
 for(const group of ["day","week","month"])assert.equal(activityTrend(report,group).points.reduce((sum,p)=>sum+p.sales,0),5);
 const long=selectReportingPeriod([{createdAt:"2023-01-01T00:00:00Z",total:2},{createdAt:"2026-10-14T00:00:00Z",total:3}],[],"all",{});assert.equal(activityTrend(long,"day").group,"month");
});
test("stock drilldowns exactly match existing priced stock metric definitions",()=>{const rows=[{id:"a",price:1,stock:8},{id:"b",price:1,stock:0},{id:"c",price:0,stock:2},{id:"d",price:1,stock:9},{id:"e",price:1,stock:3,lowStockLevel:2}];assert.deepEqual(stockMetricProducts(rows,"Low stock").map(r=>r.id),["a"]);assert.deepEqual(stockMetricProducts(rows,"Out of stock").map(r=>r.id),["b"]);assert.equal(stockMetricProducts(rows,"Products").length,5);});

test("invalid timestamps and very wide ranges stay bounded and do not lose valid amounts",()=>{const report=selectReportingPeriod([{createdAt:"2026-10-14T01:00:00Z",total:15}],[],"custom",{start:"1900-01-01",end:"9999-12-31"});const trend=activityTrend(report);assert.equal(trend.sparse,true);assert.equal(trend.points.length,1);assert.equal(trend.points[0].sales,15);const invalid=activityTrend(selectReportingPeriod([{createdAt:"invalid",total:2}],[],"all",{}));assert.equal(invalid.points.length,0);assert.equal(invalid.missingDates,1);assert.equal(stockMetricProducts([{price:1}],"Out of stock").length,0);});
