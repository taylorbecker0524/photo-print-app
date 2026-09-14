import { Metadata } from 'next'
import { MIN_ORDER_QTY, PRICE_TIERS } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions — Archive Yours',
  description: 'How the date and location stamp works, what to do when it is missing or wrong, print quality, shipping and ordering.',
}

// Driven by the pricing module so this page cannot drift from what we charge.
const TIER_BREAKS = PRICE_TIERS.map(t => t.minQty).filter(q => q > 1).sort((a, b) => a - b)

const h2 = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 26,
  fontWeight: 400,
  marginTop: 40,
  marginBottom: 4,
} as const

const q = { fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 6 } as const
const p = { fontSize: 15, lineHeight: 1.7, marginBottom: 12 } as const
const link = { color: '#D97A43', textDecoration: 'none' } as const

export default function FaqPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', color: '#2B2A28', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 400, marginBottom: 8 }}>Frequently asked questions</h1>
      <p style={{ fontSize: 14, color: '#8A6F5A', marginBottom: 8 }}>Most questions here are about the date and location stamp, so that is where we start.</p>

      <h2 style={h2}>The date and location stamp</h2>

      <h3 style={q}>Where do the date and location come from?</h3>
      <p style={p}>
        Your camera records them inside the photo file itself, invisibly, at the moment you take the picture. We read
        that information in your browser and use it for the stamp. We never guess.
      </p>

      <h3 style={q}>Why does my photo have no date or location?</h3>
      <p style={p}>
        Because something along the way removed it. The photo still looks identical, but the hidden information is gone.
        The usual causes, in rough order of how often we see them:
      </p>
      <ul style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12, paddingLeft: 22 }}>
        <li><strong>It arrived by text message.</strong> Messaging apps shrink photos to send them faster, and the hidden data goes with it.</li>
        <li><strong>It was saved from social media.</strong> Instagram, Facebook and the rest strip it deliberately, for privacy.</li>
        <li><strong>It is a screenshot.</strong> A screenshot is a brand new picture of your screen, so it carries the date you took the screenshot and no location at all.</li>
        <li><strong>It was exported with location sharing turned off.</strong> More on that below.</li>
      </ul>

      <h3 style={q}>Why is the date there but the location missing?</h3>
      <p style={p}>
        This one catches people out, and it is not a fault in your photo. Apple and Google both treat location as private
        and put a separate switch on it, so it is easy to remove the location while keeping everything else.
      </p>
      <p style={p}>
        On an iPhone, when you share a photo there is an <strong>Options</strong> button at the top of the share screen
        with a <strong>Location</strong> switch. On a Mac, <strong>File → Export</strong> has a
        {' '}<strong>Location Information</strong> tick box. If either is off, the location is stripped and the date is not.
      </p>

      <h3 style={q}>My photo came from a text message. Can I still use it?</h3>
      <p style={p}>
        Absolutely — it will print beautifully. You will just need to type the date and place yourself, because the photo
        no longer remembers them. Be a little careful with the date: photos saved out of Messages often show the date you
        saved them rather than the day the picture was taken.
      </p>

      <h3 style={q}>How do I upload a photo that keeps its date and location?</h3>
      <p style={p}>
        Upload the original from your phone photo library, or copy it to your computer with a cable, AirDrop, or
        iCloud with originals downloaded. Any method that copies the actual file keeps everything intact. What causes
        losses is sending the photo through something that recompresses it.
      </p>

      <h3 style={q}>Can I add or correct the date and location myself?</h3>
      <p style={p}>
        Yes, always. Every photo has its own date picker and location box, and you can overwrite what we detected if it
        is wrong. You can also turn either off entirely if you would rather not have it printed.
      </p>

      <h3 style={q}>Does &quot;Use my current location&quot; know where my photo was taken?</h3>
      <p style={p}>
        No, and this is worth reading twice. That button fills in where <em>you</em> are right now, which is handy when
        you are printing photos from today. If you are at home printing photos from a trip, it will stamp your home town
        on them. When in doubt, type the place yourself.
      </p>

      <h3 style={q}>The location says somewhere I have never been.</h3>
      <p style={p}>
        Phone GPS can be a few streets out indoors, and some photos record the nearest town rather than the exact spot.
        Just type over it with whatever you would rather it said — the box accepts any text, so
        {' '}&quot;Grandma&apos;s kitchen&quot; works as well as a city name.
      </p>

      <h2 style={h2}>Your photos</h2>

      <h3 style={q}>What kinds of photo can I upload?</h3>
      <p style={p}>
        Any standard image, including the HEIC files an iPhone produces by default, plus JPG and PNG.
      </p>

      <h3 style={q}>Will my photo be sharp enough to print?</h3>
      <p style={p}>
        Almost any photo taken on a phone in the last decade prints well at our sizes. The ones to watch are screenshots,
        pictures saved from social media, and photos that arrived by text, since all three have been shrunk. They are
        usually fine at 4×6, and can look soft at 8×10.
      </p>
      <p style={p}>
        A rough rule: if the photo looks sharp when you view it full screen on your phone, it will print well at the
        smaller sizes. If you are unsure about a large print, order a small one first.
      </p>

      <h3 style={q}>What happens to my photos after I order?</h3>
      <p style={p}>
        They are used to make your prints and nothing else. We never sell them or share them beyond the lab that prints
        them. See our <a href="/privacy" style={link}>Privacy Policy</a> for the full detail.
      </p>

      <h2 style={h2}>Ordering</h2>

      <h3 style={q}>Why is there a {MIN_ORDER_QTY}-print minimum?</h3>
      <p style={p}>
        Postage and card fees cost the same whether we send you one print or fifty, and below {MIN_ORDER_QTY} prints
        those fixed costs are larger than the order itself. The minimum keeps prices sane rather than forcing us to add
        a small-order fee.
      </p>

      <h3 style={q}>Do prints get cheaper if I order more?</h3>
      <p style={p}>
        Yes. The price per print drops at {TIER_BREAKS.join(', ')} prints, and the studio tells you when you are close
        to the next break so you never miss one by a print or two.
      </p>

      <h3 style={q}>Lustre or gloss?</h3>
      <p style={p}>
        Lustre has a soft, slightly matte surface that resists fingerprints — the usual choice for portraits and photos
        that will be handled. Gloss is shiny and makes colours pop, closer to the classic photo lab look. Both are
        professional photo paper; only the surface differs.
      </p>

      <h2 style={h2}>Delivery and money</h2>

      <h3 style={q}>Where do you ship?</h3>
      <p style={p}>Anywhere in the United States. We do not ship internationally yet.</p>

      <h3 style={q}>How long will my order take?</h3>
      <p style={p}>
        Prints are made to order, so there is a short production step before anything ships. Current estimates are on
        the <a href="/refund-shipping" style={link}>Shipping &amp; Refund Policy</a> page, and you will get an email with
        tracking as soon as your parcel is on its way.
      </p>

      <h3 style={q}>Why am I being charged sales tax?</h3>
      <p style={p}>
        We are based in Florida, so Florida orders include Florida sales tax at your county rate. Orders going to other
        states are not charged sales tax.
      </p>

      <h3 style={q}>Something arrived damaged or wrong.</h3>
      <p style={p}>
        Tell us and we will put it right. Email{' '}
        <a href="mailto:support@archiveyours.com" style={link}>support@archiveyours.com</a> with your order number and a
        photo of the problem. The <a href="/refund-shipping" style={link}>Shipping &amp; Refund Policy</a> sets out the
        detail.
      </p>

      <h3 style={q}>I still have a question.</h3>
      <p style={p}>
        Email <a href="mailto:support@archiveyours.com" style={link}>support@archiveyours.com</a> — a real person reads it.
      </p>
    </div>
  )
}
