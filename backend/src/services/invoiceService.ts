import PDFDocument from 'pdfkit';
import { supabase } from '../database/supabaseClient';
import { EmailService } from './emailService';

export class InvoiceService {
    static async generateInvoiceBuffer(orderId: string, invoiceNumber: string): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Fetch Order Details
                const { data: order, error } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        customer:customers(*),
                        invoice_address:addresses!invoice_address_id(*),
                        delivery_address:addresses!delivery_address_id(*),
                        items:order_items(*)
                    `)
                    .eq('id', orderId)
                    .single();

                if (error) {
                    console.error("[Invoice Service] Supabase Error fetching order:", error);
                    throw new Error(`Order fetch error: ${error.message}`);
                }
                if (!order) throw new Error("Order not found");

                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Generate PDF Content (German)

                // --- HEADER ---
                // EpicTec Logo/Text
                doc.font('Helvetica-Bold').fontSize(32).fillColor('#1E3A8A').text('EpicTec', 50, 50);
                
                // Small return address line
                doc.font('Helvetica').fontSize(8).fillColor('#333333');
                const returnAddress = 'EpicTec - Jannweg 156, 66113 Saarbrücken, Deutschland';
                doc.text(returnAddress, 50, 100);
                doc.moveTo(50, 110).lineTo(300, 110).lineWidth(0.5).strokeColor('#CCCCCC').stroke();

                // Billing Address (Left)
                const invAddr = order.invoice_address || order.delivery_address;
                doc.fontSize(10).fillColor('#000000');
                doc.text(`${invAddr.first_name} ${invAddr.last_name}`, 50, 120);
                doc.text(`${invAddr.street} ${invAddr.house_number || ''}`, 50, 135);
                doc.text(`${invAddr.zip} ${invAddr.city}`, 50, 150);
                doc.text(`${invAddr.country_code === 'DE' ? 'DEUTSCHLAND' : invAddr.country_code}`, 50, 165);

                // Delivery Address (Right)
                const delAddr = order.delivery_address || invAddr;
                doc.fontSize(8).fillColor('#666666').text('Lieferadresse', 400, 105);
                doc.fontSize(10).fillColor('#000000');
                doc.text(`${delAddr.first_name} ${delAddr.last_name}`, 400, 120);
                doc.text(`${delAddr.street} ${delAddr.house_number || ''}`, 400, 135);
                doc.text(`${delAddr.zip} ${delAddr.city}`, 400, 150);
                doc.text(`${delAddr.country_code === 'DE' ? 'DEUTSCHLAND' : delAddr.country_code}`, 400, 165);

                // --- RECHNUNG DETAILS ---
                doc.moveDown(4);
                doc.font('Helvetica-Bold').fontSize(16).text('Rechnung', 50, 220);

                const formatDate = (d: string) => {
                    if (!d) return '';
                    const dt = new Date(d);
                    return dt.toLocaleDateString('de-DE');
                };
                
                const currentDate = new Date().toISOString();
                const orderDate = order.created_at;

                doc.fontSize(10).font('Helvetica');
                const metaX1 = 50;
                const metaX2 = 200;
                let metaY = 250;

                const metaData = [
                    { label: 'Rechnung', value: invoiceNumber },
                    { label: 'Rechnungsdatum', value: formatDate(currentDate) },
                    { label: 'Bestelldatum', value: formatDate(orderDate) },
                    { label: 'Zahldatum', value: formatDate(orderDate) },
                    { label: 'Versanddatum', value: formatDate(currentDate) },
                    { label: 'Zahlart', value: order.payment_method || order.marketplace },
                    { label: 'Referenz', value: order.order_number },
                    { label: 'Händler-USt.-Id', value: 'DE315389625' }
                ];

                metaData.forEach(item => {
                    doc.text(item.label, metaX1, metaY);
                    doc.text(item.value, metaX2, metaY);
                    metaY += 15;
                });

                // --- ITEMS TABLE ---
                let tableTop = metaY + 30;
                doc.font('Helvetica-Bold');
                doc.text('Pos', 50, tableTop);
                doc.text('Nummer', 80, tableTop);
                doc.text('Artikel', 150, tableTop);
                doc.text('Anzahl', 400, tableTop, { width: 50, align: 'right' });
                doc.text('Preis', 450, tableTop, { width: 50, align: 'right' });
                doc.text('Summe', 500, tableTop, { width: 50, align: 'right' });
                
                doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).lineWidth(1).strokeColor('#000000').stroke();

                let y = tableTop + 25;
                doc.font('Helvetica');
                let pos = 1;
                let totalNet = 0;

                order.items.forEach((item: any) => {
                    const lineTotal = item.quantity * item.unit_price;
                    totalNet += lineTotal;

                    doc.text(pos.toString(), 50, y);
                    doc.text(item.sku, 80, y);
                    
                    // Article title might be long, so we define width
                    doc.text(item.title, 150, y, { width: 240 });
                    
                    // The height might have increased due to wrapping
                    const currentY = doc.y; 

                    doc.text(item.quantity.toString() + ',00', 400, y, { width: 50, align: 'right' });
                    doc.text(item.unit_price.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 50, align: 'right' });
                    doc.text(lineTotal.toFixed(2).replace('.', ',') + ' €', 500, y, { width: 50, align: 'right' });

                    y = Math.max(currentY, y + 15) + 10;
                    pos++;
                });

                // Add Shipping Line
                const shippingCost = Number(order.shipping_cost || 0);
                doc.text(pos.toString(), 50, y);
                doc.text('Versandkosten', 150, y, { width: 240 });
                doc.text('1,00', 400, y, { width: 50, align: 'right' });
                doc.text(shippingCost.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 50, align: 'right' });
                doc.text(shippingCost.toFixed(2).replace('.', ',') + ' €', 500, y, { width: 50, align: 'right' });
                y += 20;

                doc.moveTo(50, y).lineTo(550, y).lineWidth(1).strokeColor('#000000').stroke();
                y += 10;

                // --- TOTALS ---
                const finalTotal = totalNet + shippingCost;
                // Reverse calculating VAT (assuming prices are gross, and tax is 19%)
                // If prices are already gross in DB: Gross = Net / 1.19
                const taxRate = 0.19;
                const netAmount = finalTotal / (1 + taxRate);
                const taxAmount = finalTotal - netAmount;

                doc.text('Zwischensumme', 350, y, { width: 100, align: 'right' });
                doc.text(totalNet.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 100, align: 'right' });
                y += 15;

                doc.text('Versand', 350, y, { width: 100, align: 'right' });
                doc.text(shippingCost.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 100, align: 'right' });
                y += 15;

                doc.text('Gesamt Netto', 350, y, { width: 100, align: 'right' });
                doc.text(netAmount.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 100, align: 'right' });
                y += 15;

                doc.text('Umsatzsteuer (19%)', 350, y, { width: 100, align: 'right' });
                doc.text(taxAmount.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 100, align: 'right' });
                y += 15;

                doc.font('Helvetica-Bold');
                doc.text('Gesamtsumme', 350, y, { width: 100, align: 'right' });
                doc.text(finalTotal.toFixed(2).replace('.', ',') + ' €', 450, y, { width: 100, align: 'right' });

                // --- FOOTER NOTE ---
                y += 50;
                doc.font('Helvetica').fontSize(8);
                doc.text('Falls Sie Fragen zur Rechnung oder zu Ihrer Bestellung haben, zögern Sie bitte nicht, sich an unseren Kundenservice unter epictec@outlook.de zu wenden. Unsere freundlichen Mitarbeiter stehen Ihnen gerne zur Verfügung.', 50, y, { width: 500 });
                y += 30;
                doc.text('Vielen Dank für Ihr Vertrauen in EpicTec. Wir schätzen Ihre Geschäftsbeziehung sehr und hoffen, dass Sie mit unseren Produkten zufrieden sind.', 50, y, { width: 500 });
                y += 30;
                doc.text('Mit freundlichen Grüßen\nIhr EpicTec-Team', 50, y);

                // --- BOTTOM PAGE FOOTER (Columns) ---
                const pageHeight = 841.89;
                const footerY = pageHeight - 100;
                
                doc.fontSize(6).fillColor('#333333');
                
                // Col 1
                doc.text('EpicTec\nGeschäftsführer:\nMohammad Thrayab Ali\nJannweg 156\n66113 Saarbrücken', 50, footerY, { align: 'center', width: 120 });
                // Col 2
                doc.text('E-Mail:\nepictec@outlook.de\nKontakt: 040149817709\nMobil: 0159 05326835\nWebsite: www.epictec.de', 170, footerY, { align: 'center', width: 120 });
                // Col 3
                doc.text('Bankverbindung:\nIBAN: DE86 5101 0500 0012 8533 74\nBIC: SCFEDESSXXX\nSantander Bank', 290, footerY, { align: 'center', width: 120 });
                // Col 4
                doc.text('Steuernummer:\n040/253/12062\nUSt-Id: DE315389625', 410, footerY, { align: 'center', width: 120 });

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    static async createAndSendInvoice(orderId: string) {
        try {
            // Check if invoice already exists
            const { data: order, error: orderError } = await supabase.from('orders').select('invoice_number, marketplace, customer:customers(email, first_name, last_name), order_number').eq('id', orderId).single();
            if (orderError) {
                console.error("[Invoice Service] Error fetching initial order details:", orderError);
                throw new Error(`DB Error: ${orderError.message}`);
            }
            if (!order) throw new Error("Order not found in DB");
            
            if (order.marketplace === 'otto') {
                return { success: false, message: "OTTO orders generate their own invoices. Skipping." };
            }

            let invNumber = order.invoice_number;
            if (!invNumber) {
                // Client requested to use Order Number as the Invoice Number
                invNumber = order.order_number;

                // Generate PDF Buffer
                const pdfBuffer = await this.generateInvoiceBuffer(orderId, invNumber);

                // Convert to Base64 to store in DB (MVP approach, in production use S3/Supabase Storage)
                const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

                await supabase.from('orders').update({
                    invoice_number: invNumber,
                    invoice_url: pdfBase64,
                    invoice_date: new Date().toISOString()
                }).eq('id', orderId);

                // Send Email
                const cust = Array.isArray(order.customer) ? order.customer[0] : order.customer;
                if (cust && cust.email) {
                    const name = `${cust.first_name} ${cust.last_name}`;
                    await EmailService.sendInvoiceEmail(cust.email, name, order.order_number, pdfBuffer);
                }
                
                return { success: true, invoiceNumber: invNumber };
            }

            return { success: false, message: "Invoice already exists" };

        } catch (error: any) {
            console.error("[Invoice Service Error]", error);
            throw new Error(error.message || "Failed to create invoice");
        }
    }
}
