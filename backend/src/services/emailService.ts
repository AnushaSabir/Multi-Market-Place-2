import nodemailer from 'nodemailer';

export class EmailService {
    private static transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    static async sendInvoiceEmail(customerEmail: string, customerName: string, orderNumber: string, pdfBuffer: Buffer) {
        console.log(`[Email Service] Sending invoice email to ${customerEmail} for order ${orderNumber}`);
        
        try {
            await this.transporter.sendMail({
                from: `"EpicTec" <${process.env.SMTP_USER}>`,
                to: customerEmail,
                subject: `Ihre Rechnung für Bestellung ${orderNumber}`,
                text: `Guten Tag ${customerName},\n\nvielen Dank für Ihre Bestellung bei EpicTec!\n\nAnbei finden Sie die Rechnung für Ihre Bestellung ${orderNumber} als PDF-Dokument.\n\nFalls Sie Fragen zur Rechnung oder zu Ihrer Bestellung haben, zögern Sie bitte nicht, sich an unseren Kundenservice zu wenden.\n\nMit freundlichen Grüßen,\nIhr EpicTec-Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <p>Guten Tag ${customerName},</p>
                        <p>vielen Dank für Ihre Bestellung bei EpicTec!</p>
                        <p>Anbei finden Sie die Rechnung für Ihre Bestellung <strong>${orderNumber}</strong> als PDF-Dokument.</p>
                        <br/>
                        <p>Falls Sie Fragen zur Rechnung oder zu Ihrer Bestellung haben, zögern Sie bitte nicht, sich an unseren Kundenservice unter <a href="mailto:epictec@outlook.de">epictec@outlook.de</a> zu wenden. Unsere freundlichen Mitarbeiter stehen Ihnen gerne zur Verfügung.</p>
                        <br/>
                        <p>Mit freundlichen Grüßen,</p>
                        <p><strong>Ihr EpicTec-Team</strong></p>
                    </div>
                `,
                attachments: [
                    {
                        filename: `Rechnung_${orderNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            });
            console.log(`[Email Service] Email sent successfully to ${customerEmail}`);
            return true;
        } catch (error) {
            console.error("[Email Service] Failed to send email", error);
            return false;
        }
    }
}
