import express, { Request, Response } from 'express';

const app = express();
const PORT = 5000;

app.use(express.json());

async function handleCancelledAppointment(body: unknown): Promise<void> {
  // noop — real logic goes here
}

app.post('/webhook/cancelled-appointment', (req: Request, res: Response) => {
  console.log('[webhook] cancelled-appointment received:');
  console.log(JSON.stringify(req.body, null, 2));

  if (req.body?.extractionData?.didCancel === true) {
    res.status(200).json({ received: true });
    handleCancelledAppointment(req.body).catch(console.error);
    return;
  }

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
