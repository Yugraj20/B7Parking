import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import type { AppData } from "../types";
import { excelSafe, money, monthKey } from "./utils";
import { buildLedger, currentBillingPeriod } from "./ledger";

type Kind="monthly"|"yearly"|"expense"|"payment"|"outstanding"|"resident";
type Format="csv"|"xlsx"|"pdf";
export function reportRows(data:AppData,kind:Kind):Record<string,unknown>[] { const ledger=buildLedger(data); const period=currentBillingPeriod(data.settings.monthStartDay); const year=String(new Date().getFullYear());
 if(kind==="monthly") return data.expenses.filter(e=>monthKey(e.date)===period).map(e=>({Date:e.date,Expense:e.title,Category:ledger.categoryName(e.categoryId),Payer:ledger.residentName(e.payerId),Amount_INR:e.amountCents/100,Type:e.type}));
 if(kind==="yearly") return data.expenses.filter(e=>e.date.startsWith(year)).map(e=>({Date:e.date,Expense:e.title,Category:ledger.categoryName(e.categoryId),Payer:ledger.residentName(e.payerId),Amount_INR:e.amountCents/100,Type:e.type}));
 if(kind==="expense") return data.expenses.map(e=>({Date:e.date,Expense:e.title,Description:e.description??"",Category:ledger.categoryName(e.categoryId),Payer:ledger.residentName(e.payerId),Amount_INR:e.amountCents/100,Type:e.type}));
 if(kind==="payment") return data.payments.map(p=>({Date:p.date,Resident:ledger.residentName(p.residentId),Amount_INR:p.amountCents/100,Expense:p.expenseId?data.expenses.find(e=>e.id===p.expenseId)?.title??"":"",Note:p.note??""}));
 if(kind==="outstanding") return ledger.rows.filter(r=>r.remainingCents>0).map(r=>({Resident:r.resident.name,Flat:ledger.flatNumber(r.resident.flatId),Allocated_INR:r.owedCents/100,Paid_INR:r.paidCents/100,Remaining_INR:r.remainingCents/100,Status:r.status}));
 return ledger.rows.map(r=>({Resident:r.resident.name,Flat:ledger.flatNumber(r.resident.flatId),Allocated_INR:r.owedCents/100,Paid_INR:r.paidCents/100,Remaining_INR:r.remainingCents/100,Status:r.status})); }
export function downloadReport(data:AppData,kind:Kind,format:Format){const rows=reportRows(data,kind).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='string'?excelSafe(v):v]))); const name=`parkledger-${kind}-report.${format}`; if(format==='csv'){const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);return;} if(format==='xlsx'){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Report');XLSX.writeFile(wb,name);return;} const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(16);doc.text(`ParkLedger ${kind} report`,14,16);doc.setFontSize(8);const headers=Object.keys(rows[0]??{Date:'Date'});let y=26;doc.text(headers.join(' | ').slice(0,175),14,y);y+=6;for(const row of rows){if(y>195){doc.addPage();y=16;doc.text(headers.join(' | ').slice(0,175),14,y);y+=6;}doc.text(headers.map(h=>String(row[h]??'')).join(' | ').slice(0,175),14,y);y+=5;}doc.save(name);}
