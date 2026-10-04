/**
 * The Feather user guide, shown inside both apps (Help page + "?" links).
 * Write in simple English: short sentences, button names in bold exactly as on screen.
 *
 * Each section: id (used in /help#id links), group, title, roles (who sees it in the
 * Operations app; 'all' = everyone, including people not logged in), keywords (search), body.
 * The owner always sees every section.
 */
import { ROLES } from '@feather/shared';
import { Bullets, Chip, H, JourneyFlow, Note, P, Steps, Table } from './parts.jsx';

const { OWNER, SIDING_SUPERVISOR: SIDING, GATE_INSPECTOR: GATE, DISPATCH_OPERATOR: DISPATCH } = ROLES;
const FIELD = [SIDING, GATE, DISPATCH];

export const HELP_GROUPS = {
  start: 'Getting started',
  siding: 'Loading staff',
  gate: 'Receiving staff',
  dispatch: 'Dispatch office',
  offline: 'No internet',
  owner: 'Owner app',
  faq: 'Problems & answers',
};

export const HELP_SECTIONS = [
  // ---------------------------------------------------------------- Getting started
  {
    id: 'what-is-feather',
    group: 'start',
    title: 'What Feather does',
    roles: 'all',
    keywords: 'about intro words meaning shipment rr empty weight net delivery note grn',
    body: (
      <>
        <P>
          Feather keeps track of every tonne and every bag from the moment a train or ship arrives until the material reaches your warehouse or your
          customer's site. If something goes missing on the way, Feather notices, tells the owner, and stops payment to the truck company until the owner
          checks it.
        </P>
        <Bullets>
          <><b>Counts what was loaded and what arrived.</b> Every truck is weighed at both ends. Feather compares the two numbers by itself.</>
          <><b>Watches the train's free hours.</b> Railways give a few free hours to empty a train. Feather shows a live timer and warns before the late fee starts.</>
          <><b>Holds back truck payment money when material is missing.</b> The truck company is not paid in full until the owner reviews the loss.</>
          <><b>Stops sending material to customers who have not paid.</b> If a builder crosses their credit limit or has old unpaid bills, no new truck can be sent to them.</>
        </Bullets>
        <JourneyFlow />
        <H>Words you will see</H>
        <Table
          head={['Word', 'What it means']}
          rows={[
            ['Shipment', 'One train (40 to 58 wagons), barge or ship full of material you bought.'],
            ['Shipment paper', 'The paper from Railways (RR) or the shipping company (BL) that says how much material was sent.'],
            ['Trip', 'One truck carrying part of a shipment (or of your warehouse stock) to one place.'],
            ['Full truck weight', 'Weight of the truck with material, from the weighbridge slip.'],
            ['Empty truck weight', 'Weight of the empty truck.'],
            ['Material weight', 'Full truck minus empty. This is the material. Feather works it out for you.'],
            ['Free hours', 'The hours Railways or the port allow before they charge late fee (late fee).'],
            ['Delivery note', 'The dispatch paper for a truck going to a customer. Made only if the customer is within credit.'],
            ['Payment on hold', "The truck company's balance payment is on hold because something was lost or damaged."],
            ['Receipt no.', 'Goods Received Note. The number given when a truck is received.'],
            ['System stock', 'The stock Feather calculates from all trucks in and out.'],
            ['Counted stock', 'The stock your staff actually count in the warehouse.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'login',
    group: 'start',
    title: 'The two apps and how to log in',
    roles: 'all',
    keywords: 'login log in pin otp email code logout install home screen',
    body: (
      <>
        <P>
          Feather has two apps. The <b>Owner app</b> is for the owner, on a laptop or phone. The <b>Operations app</b> is for everyone working on the
          ground, on a mobile phone. Each person only sees the screens for their own job.
        </P>
        <Table
          head={['Who', 'App', 'What they see']}
          rows={[
            ['Owner', 'Owner app', 'Everything: money, stock, trucks, customers, truck companies, settings'],
            ['Loading staff', 'Operations app', 'Shipments at their unloading point, and the "Load a truck" form'],
            ['Receiving staff', 'Operations app', 'Trucks coming to their warehouse, the "Receive" form, stock count'],
            ['Dispatch office', 'Operations app', 'Shipment timers, late trucks, customer orders, sending trucks from the warehouse'],
          ]}
        />
        <H>Field staff: phone + PIN</H>
        <Steps>
          <>Open the Operations app and stay on the <b>Field staff (PIN)</b> tab.</>
          <>Type your 10 digit mobile number and your PIN.</>
          <>Tap <b>Log in</b>.</>
        </Steps>
        <Note>Wrong PIN 5 times locks you out for 15 minutes. Forgot your PIN? Ask the owner to set a new one.</Note>
        <H>Office staff: email code</H>
        <Steps>
          <>Type your office email and tap <b>Send code</b>. (Dispatch uses the <b>Office (email)</b> tab of the Operations app.)</>
          <>Open your email. You get a 6 digit code. It works for 10 minutes.</>
          <>Type the code and tap <b>Log in</b>.</>
        </Steps>
        <H>Logging out</H>
        <P>
          Tap the round button with your first letter at the top right, then <b>Log out</b>. If the owner changes your PIN or turns off your account, you
          are logged out on every phone automatically.
        </P>
        <H>Put the Operations app on your phone's home screen</H>
        <P>
          Open the app link in Chrome. Tap the menu (three dots), then <b>Add to Home screen</b> or <b>Install app</b>. It now opens like a normal app,
          even with no network.
        </P>
      </>
    ),
  },

  // ---------------------------------------------------------------- Siding supervisor
  {
    id: 'siding-rakes',
    group: 'siding',
    title: 'Shipments screen and the free-hours timer',
    roles: [SIDING],
    keywords: 'shipment train timer late fee free hours arrived finish empty speed',
    body: (
      <>
        <P>This screen shows every shipment at your unloading point. Each one has a card with a timer.</P>
        <Table
          head={['On the card', 'What it means']}
          rows={[
            [<Chip tone="good">On track</Chip>, 'You will finish unloading inside the free hours.'],
            [<Chip tone="warn">Running late</Chip>, "At today's speed you will go past the free hours. Ask for more trucks."],
            [<Chip tone="bad">Late fee started</Chip>, 'Late fee has started.'],
            ['Free hours left', 'Hours and minutes before late fee starts.'],
            ['Still to unload', 'Material still on the shipment.'],
            ['Unloading speed / hr', 'How much you are unloading per hour right now.'],
            ['Speed needed / hr', 'How much you must unload per hour to finish in time. Red means you are too slow.'],
          ]}
        />
        <P>Below the shipments you see <b>Trucks loaded today</b>: your trucks and whether each has reached its destination.</P>
        <H>Start the timer when the train arrives</H>
        <P>
          A new shipment says "Not arrived yet". When it reaches your unloading point, tap <b>Train has arrived — start timer</b> and confirm. Feather saves the time
          from its own clock, not from your phone. If you forget, the timer starts when you load the first truck from that shipment.
        </P>
        <H>Release the shipment when it is empty</H>
        <P>
          When the last wagon is empty, tap <b>All unloaded — finish</b> and confirm. After this no more trucks can load from it, and the final late fee (if
          any) is fixed.
        </P>
      </>
    ),
  },
  {
    id: 'load-truck',
    group: 'siding',
    title: 'Load a truck, step by step',
    roles: [SIDING, DISPATCH],
    keywords: 'load truck loading weighbridge slip photo full truck empty weight bags driver truck company on hold red payment price per truck new price calculation method bag count labour cost',
    body: (
      <>
        <Steps>
          <>Tap <b>Load a truck</b> (or <b>Load truck</b> in the bottom bar).</>
          <><b>Shipment</b>: choose the shipment the material is coming from.</>
          <><b>Going to</b>: choose one of your warehouses or a delivery site.</>
          <>For a delivery site, choose the <b>Customer order</b> for that site.</>
          <><b>Truck number</b>: for example MH12AB1234. Spaces do not matter. If this truck came before, driver and truck company fill in by themselves.</>
          <>Type <b>Driver name</b> and <b>Driver mobile</b>, and choose the <b>Truck company</b>.</>
          <>Choose the <b>Calculation method</b>: <b>Full truck and empty truck weight</b> (weighbridge), or <b>Number of bags loaded</b> (cement in bags only).</>
          <>By weight: from the weighbridge slip, type <b>Full truck</b> and <b>Empty truck</b> in tonnes. Check the <b>Material weight</b> shown below matches the slip.</>
          <>For cement, type <b>Bags loaded</b>. By bag count, Feather works out the material weight from the bags (for example 600 bags × 50 kg = 30 T).</>
          <>Type the <b>Slip number</b> if there is one.</>
          <>Tap <b>Tap to open camera</b> and take a clear photo of the slip. Only the camera works. Old gallery photos are not allowed.</>
          <><b>Labour cost</b> (trucks from a shipment): check the <b>Labour cost per truck</b> the owner set for this station or port.</>
          <>If unloading cost more for this truck, turn on <b>Ask for a different labour cost</b>, type the new cost and write why.</>
          <><b>Payment</b>: check the <b>Price per truck</b> the owner set for this route.</>
          <>If the truck company wants a different price, turn on <b>Ask for a different price</b>, type the <b>New price per truck</b> and write why.</>
          <>Tap <b>Save & send truck</b>.</>
        </Steps>
        <Note>
          A new labour cost or price is only a request. The owner gets a notification and must approve it. Until then, the owner's amount is used.
        </Note>
        <P>
          You see <b>Truck sent</b> with the trip number (and a delivery note number for customer trucks). Tap <b>Load next truck</b>. The shipment, destination and
          order stay filled in, so the next truck is faster.
        </P>
        <Note tone="warn">
          <b>Customer on hold</b> in a red box means the customer has crossed their credit limit or has old unpaid bills. <b>Do not load this truck.</b> The
          owner has already been told. Only the owner can allow it.
        </Note>
        <H>Boxes marked in red</H>
        <P>
          Read the message under the box. Common ones: wrong truck number, mobile number not 10 digits, full truck weight less than empty weight, photo missing.
        </P>
        <Note>Once saved, you cannot change a truck. If you made a mistake, tell the owner. The owner can correct it, and the change is recorded.</Note>
      </>
    ),
  },

  // ---------------------------------------------------------------- Gate inspector
  {
    id: 'arrivals',
    group: 'gate',
    title: 'Incoming: trucks coming to you',
    roles: [GATE],
    keywords: 'arrivals incoming search truck list refresh',
    body: (
      <>
        <P>
          This list shows every truck on its way to your warehouse or site: truck number, material, where it came from, when it left, truck company and driver.
        </P>
        <Bullets>
          <>Use the search box to find a truck by its number.</>
          <>Tap the round arrow to refresh the list.</>
          <>When a truck reaches your weighbridge, tap it to open the receive form.</>
        </Bullets>
        <P>Truck not in the list? Check the number. If it is still missing, ask dispatch whether it was entered at loading.</P>
        <Note>
          You will not see the weight loaded at the unloading point, or how many bags were billed. This is on purpose. Just weigh and count what is really there.
          Feather does the comparing.
        </Note>
      </>
    ),
  },
  {
    id: 'receive-truck',
    group: 'gate',
    title: 'Receive a truck and count bags',
    roles: [GATE],
    keywords: 'receive receipt grn weigh empty bags count good torn burst hard wet lumpy light missing',
    body: (
      <>
        <Steps>
          <>Tap the truck in <b>Incoming</b>. Check the truck number at the top.</>
          <>Type <b>Full truck weight</b> from your weighbridge slip.</>
          <>After unloading, weigh the empty truck and type <b>Empty truck</b>.</>
          <>Check <b>Material received</b> matches your slip. Type the <b>Slip number</b> if there is one.</>
          <>For cement, count every bag (see below).</>
          <>Take a photo of the weighbridge slip, or of damaged bags.</>
          <>In <b>Remarks</b>, write anything unusual, for example "tarpaulin torn, rain water in truck".</>
          <>Tap <b>Submit receipt</b>. You get a Receipt no. number. Tap <b>Next truck</b>.</>
        </Steps>
        <H>Counting cement bags</H>
        <P>Put every bag into one of these four boxes:</P>
        <Table
          head={['Box', 'Put a bag here if', 'What happens to it']}
          rows={[
            ['Good bags', 'The bag is fine', 'Goes to saleable stock'],
            ['Torn / burst bags', 'Bag is torn, but cement inside is clean', 'Swept up, re-bagged, sold at a discount'],
            ['Hard / wet bags', 'Cement has set hard or is lumpy from water', 'Rejected. Cost is charged to the truck company'],
            ['Light bags', 'Bag looks full but weighs less', 'Charged to the truck company by weight'],
          ]}
        />
        <P>If you enter any <b>Light bags</b>, weigh about 5 of them on the platform scale and type their <b>average weight</b> in kg.</P>
        <Note>You do not enter missing bags. Feather works them out by itself: bags billed minus bags you counted.</Note>
        <Note tone="warn">After submit you cannot change it. Only the owner can correct an entry.</Note>
      </>
    ),
  },
  {
    id: 'stock-count',
    group: 'gate',
    title: 'Count stock',
    roles: [GATE],
    keywords: 'stock count physical measure heap warehouse grade',
    body: (
      <>
        <P>Use this when the owner asks you to count or measure the stock in your warehouse.</P>
        <Steps>
          <>Tap <b>Count stock</b>.</>
          <>Choose the <b>Warehouse</b> and the <b>Material</b>.</>
          <>Choose the <b>Grade</b>: Good, Discount or Rejected.</>
          <>Type the <b>Quantity found</b>: bags for cement, tonnes for sand and aggregate.</>
          <>Optional: <b>How measured</b>, for example "heap 12 × 8 × 2.5 m".</>
          <>Tap <b>Save count</b>.</>
        </Steps>
        <Note>You will not see the stock Feather has on its books. This is on purpose: enter only what you see.</Note>
      </>
    ),
  },

  // ---------------------------------------------------------------- Dispatch
  {
    id: 'dispatch-board',
    group: 'dispatch',
    title: 'Today: shipments, late trucks and breakdowns',
    roles: [DISPATCH],
    keywords: 'board delayed breakdown call driver assign order send to customer delivery note on road',
    body: (
      <>
        <P>
          At the top you see the timer of every shipment being unloaded, with the expected late fee in rupees at today's speed. If a card turns yellow or
          red, arrange more trucks.
        </P>
        <Table
          head={['Tab', 'What it shows', 'What you can do']}
          rows={[
            ['Delayed', 'Trucks on the road longer than normal, and broken-down trucks', <>Tap <b>Call</b> to phone the driver, <b>Breakdown</b> to report one, <b>Moving again</b> when fixed.</>],
            ['Send to customer', 'Shipment trucks not yet tied to a customer order', <>Tap <b>Assign order</b> to send that truck to a customer.</>],
            ['All on road', 'Every truck on the road now', 'Look only'],
          ]}
        />
        <H>Report a breakdown</H>
        <P>Tap <b>Breakdown</b>, write what happened and where (for example "tyre burst near Km 42"), then tap <b>Report</b>. The owner sees it in Alerts.</P>
        <H>Send a shipment truck to a customer</H>
        <P>
          Tap <b>Assign order</b>, choose the order, tap <b>Make delivery note</b>. Feather checks the customer's credit first. If fine, a delivery note is made and the
          truck now goes to the customer's site.
        </P>
      </>
    ),
  },
  {
    id: 'orders',
    group: 'dispatch',
    title: 'Customer orders',
    roles: [DISPATCH],
    keywords: 'order new order close credit ok on hold special permission delivery site rate',
    body: (
      <>
        <P>This lists all open orders: customer, material, site, rate, how much is sent, and a badge.</P>
        <Table
          head={['Badge', 'Meaning']}
          rows={[
            [<Chip tone="good">Credit OK</Chip>, 'Trucks can be sent.'],
            [<Chip tone="bad">On hold</Chip>, 'No truck until the customer pays or the owner allows it anyway. The reason is shown in red.'],
            [<Chip tone="warn">Allowed</Chip>, 'The owner has allowed a few trucks for a short time.'],
          ]}
        />
        <H>Make a new order</H>
        <Steps>
          <>Tap <b>New order</b>.</>
          <>Choose the customer and their <b>Delivery site</b>. (No site? Ask the owner to add one.)</>
          <>Choose the material, type quantity and rate.</>
          <>Tap <b>Save order</b>. If the customer is already on hold, the order is saved but you see a warning that trucks cannot go yet.</>
        </Steps>
        <P>When everything is sent, a <b>Close order</b> button appears on the card.</P>
      </>
    ),
  },
  {
    id: 'dispatch-yard',
    group: 'dispatch',
    title: 'Send a truck from the warehouse',
    roles: [DISPATCH],
    keywords: 'dispatch warehouse warehouse send customer delivery note system stock',
    body: (
      <>
        <Steps>
          <>Tap <b>Send truck</b>.</>
          <>Choose <b>From warehouse</b>, the delivery site in <b>Going to</b>, then the <b>Customer order</b>.</>
          <>Fill in truck, driver, truck company, weights and slip photo, the same as loading from a shipment.</>
          <>Tap <b>Save & send truck</b>.</>
        </Steps>
        <P>Feather will stop you if:</P>
        <Bullets>
          <>the customer is over credit or has old unpaid bills (<b>Customer on hold</b>), or</>
          <>the warehouse does not have that much stock on its books. Ask the owner to check the stock count.</>
        </Bullets>
      </>
    ),
  },

  // ---------------------------------------------------------------- Offline
  {
    id: 'offline',
    group: 'offline',
    title: 'Working with no internet',
    roles: FIELD,
    keywords: 'offline no network signal saved on phone outbox waiting not accepted send now',
    body: (
      <>
        <P>
          You can keep loading and receiving trucks with no signal. Feather saves the entry on the phone, with the photo, and sends it by itself when the
          signal comes back.
        </P>
        <Bullets>
          <>The top bar shows a green <b>Online</b> dot when connected, and a red <b>Offline</b> when not.</>
          <>After saving offline you see <b>Saved on phone</b> instead of "Truck sent". This is normal. Keep working.</>
          <>The orange number at the top is how many entries are waiting. Tap it to open <b>Saved on this phone</b>.</>
        </Bullets>
        <Table
          head={['Badge', 'Meaning', 'What to do']}
          rows={[
            [<Chip tone="warn">Waiting</Chip>, 'Not sent yet, no network', <>Nothing. It goes by itself. Tap <b>Send now</b> when signal is back.</>],
            [<Chip tone="bad">Not accepted</Chip>, 'The office refused it. The reason is in red.', <>Tap <b>Try again</b>, or <b>Delete</b> and enter it again correctly.</>],
          ]}
        />
        <Note tone="warn">Do not log out while entries are waiting. Keep the app on the same phone.</Note>
        <P>
          The time saved for an offline truck is when it reached the office, not when you tapped Save. The phone's own time is kept too. Sending the same
          entry twice never makes a double entry.
        </P>
      </>
    ),
  },

  // ---------------------------------------------------------------- Owner app
  {
    id: 'owner-dashboard',
    group: 'owner',
    title: 'Home page',
    roles: [OWNER],
    keywords: 'dashboard home flow on the way trucks warehouses truck payment on hold overdue',
    body: (
      <>
        <P>
          The first page after login. In one look it tells you where your material is, where money is stuck, and what needs attention. It refreshes every
          minute. The bell at the top right has a red dot when there are unread alerts.
        </P>
        <H>Where your material is right now</H>
        <P>Four steps, left to right, like tracking a parcel. Click any step to see the details.</P>
        <Table
          head={['Step', 'What it tells you']}
          rows={[
            ['1. On the way', 'Material on trains, barges and ships that have not arrived yet'],
            ['2. Being unloaded', 'Material still on shipments at the unloading point'],
            ['3. On trucks', 'Material on trucks now, and how many trucks are late'],
            ['4. In our warehouses', 'Stock in your warehouses, as per the system'],
          ]}
        />
        <P>Cement is turned into tonnes here so everything adds up. The bag count is shown under the number.</P>
        <H>Money</H>
        <Table
          head={['Card', 'What it tells you', 'Red means']}
          rows={[
            ['Payment on hold', 'Trucks with loss or damage, and the total to deduct', 'You have trips to review'],
            ['Truck payments ready', 'Truck company balance you can pay now', '—'],
            ['Customers on hold', 'Customers who cannot get a new truck', 'Someone is over credit or overdue'],
            ['Overdue payments', 'Money owed past credit days', 'Follow up for payment'],
          ]}
        />
        <H>The rest of the page</H>
        <Bullets>
          <><b>Shipments being unloaded now</b>: live timer with the expected late fee. Click a card to open the shipment.</>
          <><b>Truck companies — last 30 days</b>: worst first. Weight lost, bags damaged, share of problem trips, money deducted.</>
          <><b>Latest alerts</b>: newest 8. <b>See all</b> opens Alerts.</>
          <><b>Customer dues</b>: how much each customer owes against their limit, how old the dues are, and why they are on hold. Click a row to open the customer.</>
          <><b>Excel</b> buttons download that table.</>
        </Bullets>
      </>
    ),
  },
  {
    id: 'owner-rakes',
    group: 'owner',
    title: 'Shipments',
    roles: [OWNER],
    keywords: 'shipment ship barge new shipment rr bill of lading wagons free hours late fee release close',
    body: (
      <>
        <P>Every train, barge or ship you buy is added here when its shipment paper (RR or Bill of Lading) arrives. All trucks loaded from it link back to it.</P>
        <H>Add a new shipment</H>
        <Steps>
          <>Tap <b>New shipment</b> and choose the <b>Type</b>.</>
          <>Type the <b>shipment paper number</b> (RR or Bill of Lading). Choose the <b>Material</b> — the <b>Seller</b> fills in from the product; change it if you bought this shipment from someone else.</>
          <>Choose the <b>Material</b> and the <b>Unloading point</b>.</>
          <>Type the <b>Quantity</b> on the paper and choose its <b>Unit</b>: <b>KG</b>, <b>Metric Tonne (MT)</b> or <b>Bags</b> (cement only). Feather shows it in tonnes or bags underneath. For a train, the number of <b>Wagons</b> is required.</>
          <>
            <b>Free hours</b> starts at 9 — change it if your paper says otherwise. For the <b>Late fee</b>, choose <b>Per hour</b>, <b>Per day</b> or{' '}
            <b>One time</b>, then type the amount. For a train it is charged per wagon.
          </>
          <>Optional: <b>Total billing amount</b> from the seller's bill (only you see it — Feather works out the rate per unit), <b>Expected arrival</b>, <b>Notes</b>.</>
          <>
            Optional: under <b>Attach bill / documents</b>, tap <b>Attach files</b> and choose the seller&apos;s bill, the RR / Bill of Lading or other papers
            (PDF or picture, up to 10 MB each). Pick what each file is.
          </>
          <>Tap <b>Save</b>. The shipment appears on the loading staff's phone as "On the way". Attached files are uploaded right after.</>
        </Steps>
        <Note>
          Documents can also be added later: open the shipment and use <b>Documents → Add</b>. Click a file to open it. <b>Remove</b> takes it off the shipment
          (your reason is kept in History). Only you can see documents.
        </Note>
        <Table
          head={['Status', 'Meaning']}
          rows={[
            ['On the way', 'Added, not yet at the unloading point'],
            ['Unloading', 'Arrived at the unloading point. The free-hours timer is running.'],
            ['Emptied', 'Fully unloaded and handed back. Final late fee is fixed.'],
            ['Closed', 'All trucks received and checked.'],
          ]}
        />
        <H>Opening one shipment</H>
        <Bullets>
          <><b>The timer</b> (while unloading): free hours left, unloading speed now vs needed, expected late fee.</>
          <><b>On the paper</b>: what the shipment paper says, and how much was unloaded.</>
          <><b>Left on the train</b>: not unloaded yet. Red after it is marked emptied, because that material is missing.</>
          <><b>On the road</b> and <b>Lost between unloading point and warehouse</b> (tonnes lost across received trucks).</>
          <><b>Trucks</b>: every truck from this shipment. Click one to open it.</>
        </Bullets>
        <P>
          Buttons: <b>Edit</b> (fix typing mistakes), <b>Mark arrived</b>, <b>Mark emptied</b>, and <b>Close</b> (after it is emptied, with a reason, only when no
          truck is still on the road).
        </P>
      </>
    ),
  },
  {
    id: 'owner-trips',
    group: 'owner',
    title: 'Truck trips: checking each truck',
    roles: [OWNER],
    keywords: 'trips search filter issues flags photo weighment loss gain empty weight',
    body: (
      <>
        <P>
          Find a truck with <b>Search</b> (truck, trip or delivery note number) and the filters <b>Trip status</b>, <b>Truck payment</b> and <b>Issues</b>. Click a row
          to open it.
        </P>
        <P>
          Inside, the two weighments sit side by side, each with the slip photo. Click a photo to see it big. The pin under it opens the place on Google
          Maps where the photo was taken. Problems show in a red <b>Issues found</b> box:
        </P>
        <Table
          head={['Issue', 'What it usually means']}
          rows={[
            ['Weight lost on the road', 'Loss beyond the allowed amount. Possible theft on the way.'],
            ['Weight increased on the road', 'Usually water added to hide stolen material.'],
            ['Damaged bags / Bags missing', 'Cement bags torn, wet, light or not on the truck'],
            ['More bags counted than billed', 'Counting mistake, or wrong paperwork'],
            ['Empty truck weight is unusual', "Different from this truck's usual empty weight (extra diesel, people, parts)"],
            ['Empty weight differs between the two weighbridges', 'One of the slips may be wrong'],
            ['Took much longer than normal', 'The truck stopped somewhere'],
            ['Breakdown reported', 'Dispatch reported a breakdown'],
            ['Entered while offline', 'Saved on a phone with no signal, sent later'],
            ['Sent under special permission', 'Sent to a on hold customer with your permission'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'owner-freight',
    group: 'owner',
    title: 'Paying truck companies and fixing mistakes',
    roles: [OWNER],
    keywords: 'truck payment pay paid approve waive deduction advance recover correct weights cancel trip price per truck new price request labour cost approval',
    body: (
      <>
        <P>
          The truck payment box shows truck payment minus advance minus deduction = <b>Balance to pay</b>. If the deduction is bigger, a red line says how much to
          recover from the truck company.
        </P>
        <P>
          Truck payment is your <b>price per truck</b> for the route (set in <b>Business setup</b>, on each warehouse or delivery site). If no price is set for the
          route, it is the truck rate × quantity.
        </P>
        <H>New price or labour cost asked by loading staff</H>
        <P>
          Loading staff can ask for a different <b>price per truck</b> or <b>labour cost per truck</b> (your per-truck labour cost for the station or port, set in{' '}
          <b>Business setup</b>) when they load. You get an alert, and the trip shows the request (all of them are in the <b>Needs approval</b> quick view on{' '}
          <b>Truck trips</b>). <b>Approve new amount</b> to use it, or <b>Keep my rate</b> (reason needed). Until you decide, your amount is used. A truck payment
          with a price waiting for approval cannot be marked paid.
        </P>
        <Table
          head={['Truck payment status', 'Meaning', 'Your buttons']}
          rows={[
            ['Waiting for receipt', 'Truck not received yet', <b>Record advance</b>],
            [<Chip tone="bad">On hold — needs review</Chip>, 'Loss or damage found. Payment on hold.', <><b>Pay with cut</b>, <b>Pay in full</b></>],
            [<Chip tone="good">Ready to pay</Chip>, 'Checked. Balance can be paid.', <><b>Mark paid</b>, <b>Pay in full</b></>],
            ['Paid', 'Done', '—'],
          ]}
        />
        <Bullets>
          <><b>Pay with cut</b>: you agree with Feather's deduction.</>
          <><b>Pay in full</b>: pay in full, for example if the weighbridge was faulty. Reason needed.</>
          <><b>Mark paid</b>: after you pay the balance outside Feather.</>
          <><b>Record advance</b>: total advance already given for this truck.</>
        </Bullets>
        <H>Fixing mistakes</H>
        <Bullets>
          <><b>Correct weights</b>: only when the typed weight does not match the slip photo. Feather runs every check again and fixes stock and bills.</>
          <><b>Cancel trip</b>: only for a truck still on the road entered by mistake. The quantity goes back.</>
        </Bullets>
        <Note>Every correction and cancellation is saved in the History with your reason.</Note>
      </>
    ),
  },
  {
    id: 'owner-credit',
    group: 'owner',
    title: 'Customer dues',
    roles: [OWNER],
    keywords: 'customer credit limit on hold overdue how old the dues are payment bill invoice special permission opening balance',
    body: (
      <>
        <P>Feather stops new trucks to a customer who owes too much. A customer is <b>on hold</b> when either is true:</P>
        <Bullets>
          <>Total owed goes over their credit limit (default ₹25 Lakh). Total owed = unpaid bills + value of material already on the road to them.</>
          <>They have any bill older than their credit days (default 45 days).</>
        </Bullets>
        <P>The defaults can be changed in Settings, and each customer can have their own limit.</P>
        <H>The list and one customer</H>
        <P>
          Each row shows a bar of credit used (green fine, yellow over 80%, red over limit), value on the road, unpaid by age, and why on hold. Click a
          customer for <b>Bills</b>, <b>Payments</b>, <b>Special permissions</b> and <b>Sites</b>. Bills are made by Feather when a delivery is received at the site.
        </P>
        <Bullets>
          <>To add a customer, go to <b>Setup → Business setup → Customers → New customer</b>. Leave limit and days blank to use the default, then add their sites in the <b>Places</b> tab.</>
          <><b>Record payment</b>: amount, date, cheque / UTR. Oldest bills are cleared first. Extra is kept as advance.</>
          <><b>Add bill</b>: for old amounts from your earlier books.</>
          <><b>Allow anyway</b> (only when on hold): let a set number of delivery notes go for a set time, with a reason. The block comes back by itself after that.</>
          <><b>Stop allowing</b>: end it early.</>
        </Bullets>
      </>
    ),
  },
  {
    id: 'owner-transporters',
    group: 'owner',
    title: 'Truck companies scorecard',
    roles: [OWNER],
    keywords: 'truck company scorecard loss damage problem trips deducted rate',
    body: (
      <>
        <P>Shows which truck companies lose material or damage bags. Choose the period at the top. The worst one is first.</P>
        <Table
          head={['Column', 'Meaning']}
          rows={[
            ['Trips', 'Trucks received in the period'],
            ['Loaded / Lost', 'Tonnes loaded, and tonnes lost on the road'],
            ['Loss %', 'Lost ÷ loaded'],
            ['Bags damaged / missing', 'Torn, wet or light bags, and missing bags (cement)'],
            ['Problem trips', 'Trips where the truck payment was put on hold. Green under 5%, yellow 5–20%, red over 20%.'],
            ['Deducted', 'Total money cut from their truck payment'],
          ]}
        />
        <P>
          Below is <b>All truck companies</b>. Use <b>Edit</b> to change name, phone, GSTIN and usual truck rate. To add a truck company, go to{' '}
          <b>Setup → Business setup → Truck companies → New truck company</b>.
        </P>
      </>
    ),
  },
  {
    id: 'owner-sellers',
    group: 'owner',
    title: 'Sellers: who you buy from',
    roles: [OWNER],
    keywords: 'sellers suppliers vendors buy purchase add new seller',
    body: (
      <>
        <P>
          Open <b>Money → Sellers</b>. The tiles at the top show <b>Total sellers</b>, how many are <b>Active</b> and <b>Off</b>, and how many were added in the last
          30 days.
        </P>
        <P>To add a seller:</P>
        <Steps>
          <>Go to <b>Setup → Business setup → Sellers</b> and tap <b>New seller</b>.</>
          <>Type the <b>Seller name</b>. Contact person, phone, email, GSTIN and address are optional.</>
          <>Tap <b>Save</b>.</>
        </Steps>
        <P>
          Use <b>Edit</b> to change a seller. Switch <b>Active</b> off for a seller you no longer buy from — they stay in the list for history. Use the <b>All / Active /
          Off</b> buttons to filter the list.
        </P>
        <Note>Only you (the owner) can see and change sellers. Office and field staff cannot.</Note>
      </>
    ),
  },
  {
    id: 'owner-stock',
    group: 'owner',
    title: 'Inventory: system vs counted',
    roles: [OWNER],
    keywords: 'stock book stock count accept adjust prime seconds rejected',
    body: (
      <>
        <P>
          Feather keeps <b>system stock</b> for each warehouse by itself: it adds every truck received and takes away every truck dispatched. Cement has three
          grades: <b>Prime</b> (good), <b>Seconds</b> (re-bagged, sold at discount) and <b>Rejected</b>.
        </P>
        <Bullets>
          <><b>System now</b>: what should be there.</>
          <><b>Last count</b>: what the receiving staff counted.</>
          <><b>Difference at count</b>: red if more than 1% off. A big shortfall means material went missing from the warehouse.</>
        </Bullets>
        <P>If you trust a count, tap <b>Accept count</b> and write a reason. System stock is set to the counted amount and saved in the history.</P>
      </>
    ),
  },
  {
    id: 'owner-alerts',
    group: 'owner',
    title: 'Alerts',
    roles: [OWNER],
    keywords: 'alerts email notification bell read',
    body: (
      <>
        <P>Feather raises an alert whenever something needs your eyes. Serious ones are also emailed to you.</P>
        <Table
          head={['Alert', 'When it comes']}
          rows={[
            ['Payment on hold', 'Weight lost or gained, or bags damaged / missing'],
            ['Unusual empty weight', "A truck's empty weight is far from its usual"],
            ['Running late / Late fee started', 'A shipment will not finish in time, or late fee started'],
            ['Customer on hold', 'Someone tried to send a truck to a on hold customer'],
            ['Allowed anyway', 'A on hold customer was allowed'],
            ['Truck delayed / Breakdown', 'A truck is much slower than normal, or broke down'],
            ['Stock mismatch', 'A stock count is far from system stock'],
            ['PIN changed', 'A field staff PIN was reset'],
          ]}
        />
        <P>Each alert links to its trip, customer or shipment. Use <b>Mark read</b> or <b>Mark all read</b>.</P>
      </>
    ),
  },
  {
    id: 'owner-setup',
    group: 'owner',
    title: 'Business setup and staff',
    roles: [OWNER],
    keywords: 'business setup products materials places unloading point warehouse delivery site customers sellers truck companies add new users role pin works at active your cost tolerance density seller distance price per truck labour cost',
    body: (
      <>
        <P>
          <b>Setup → Business setup</b> is where you add and change everything your business works with. It has five tabs: <b>Products</b>, <b>Places</b>,{' '}
          <b>Customers</b>, <b>Sellers</b> and <b>Truck companies</b>. The <b>New …</b> button at the top adds to the tab you are on; <b>Edit</b> on a row changes it.
          The Money pages show the numbers for customers, sellers and truck companies.
        </P>
        <H>Materials</H>
        <Bullets>
          <><b>Seller name</b>: who you buy this product from, chosen from the <b>Sellers</b> tab. Every product needs one. Only you see it.</>
          <><b>Counted in</b>: Weight (MT) for sand, aggregate, soil, or Bags for cement. Cannot change later.</>
          <><b>Allowed road loss %</b>: for example 0.5 for wet sand. Blank uses the Settings default.</>
          <><b>Density</b>: tonnes per cubic metre, for brass ↔ MT.</>
          <><b>Your cost</b>: your cost per MT or bag, used to value losses. Only you see it.</>
        </Bullets>
        <H>Unloading points, warehouses & sites</H>
        <P>
          Types: Railway station, Port, Warehouse, Delivery site. A delivery site must be linked to a customer. Set <b>Normal road time</b> for warehouses
          and sites. Slower trucks are flagged as delayed.
        </P>
        <Bullets>
          <>
            <b>Distance from unloading points</b> (warehouses and delivery sites): one row per railway station or port — distance in km and your <b>price per
            truck</b>. That price is the truck payment for trucks on that route.
          </>
          <>
            <b>Unloading labour cost</b> (railway stations and ports): per wagon, per truck and per kg. Loading staff see the per-truck cost on each truck.
          </>
        </Bullets>
        <H>Staff</H>
        <Steps>
          <>Tap <b>New staff member</b> and choose the <b>Role</b>.</>
          <>Owner and Dispatch office: type their email. Loading staff and Receiving staff: type their mobile number and a 4–6 digit PIN. Tell them the PIN in person.</>
          <><b>Works at</b>: tick their unloading point or warehouse. They only see trucks and shipments for those places.</>
        </Steps>
        <P>Use <b>Edit</b> to change role or places, switch <b>Active</b> off to block someone at once, or <b>PIN</b> to set a new PIN. These log the person out everywhere.</P>
      </>
    ),
  },
  {
    id: 'owner-settings',
    group: 'owner',
    title: 'Settings, history and Excel',
    roles: [OWNER],
    keywords: 'settings rules tolerance credit limit days history excel export download',
    body: (
      <>
        <H>Settings</H>
        <Table
          head={['Setting', 'What it controls']}
          rows={[
            ['Default allowed road loss', 'Loss above this % locks truck payment (unless the material has its own)'],
            ['Empty truck weight warning', "% difference from the truck's last 10 trips that raises an alert"],
            ['Empty weight difference between weighbridges', 'Tonnes of difference that locks truck payment'],
            ['Normal road time / Delay alert after', 'When a truck counts as delayed (1.5 = 50% slower than normal)'],
            ['Discount on re-bagged torn cement', 'Usually 20%. Turn on "Charge torn-bag discount" to also charge it.'],
            ['Default credit limit / credit days', 'For customers without their own'],
            ['Warn before free hours end', 'How many hours before the free hours end to send a warning'],
            ['Stock count mismatch alert', '% difference between system and counted stock that raises an alert'],
            ['Extra alert emails', 'More people who should get alerts'],
          ]}
        />
        <H>History</H>
        <P>Every important change: who, when and why. Click a row to see before and after. Nobody can edit or delete it.</P>
        <H>Excel downloads</H>
        <P>
          Use the <b>Excel</b> buttons on Home / Truck trips (all trips with weights, bags, issues, truck payment), Shipments, Truck companies, Customer dues and
          Stock.
        </P>
      </>
    ),
  },

  // ---------------------------------------------------------------- FAQ
  {
    id: 'faq',
    group: 'faq',
    title: 'Common problems',
    roles: 'all',
    keywords: 'forgot pin code email camera location stuck problem help error',
    body: (
      <Table
        head={['Problem', 'What to do']}
        rows={[
          ['I forgot my PIN', <>Ask the owner. Owner opens <b>Staff</b>, taps <b>PIN</b> next to your name.</>],
          ['"Too many wrong PINs"', 'Wait 15 minutes, or ask the owner for a new PIN.'],
          ['Login code email did not come', <>Check spam. Wait one minute, then tap <b>Send code</b> again. The code works for 10 minutes.</>],
          ['"Please log in again"', 'Your PIN or role was changed, or you were away 7 days. Log in again.'],
          ['I saved a wrong weight', <>Tell the owner. The owner uses <b>Correct weights</b> on that trip.</>],
          ['A truck is not in Incoming', 'Search by number and refresh. Still missing? Ask dispatch if it was loaded in Feather.'],
          ['"Customer on hold"', 'Do not load. The customer must pay, or the owner must allow it anyway.'],
          ['"System stock at this warehouse is only…"', 'The books show less stock than you are sending. Ask the owner to check the stock count.'],
          ['The camera does not open', "Allow camera permission for the app in the phone's settings."],
          ['"Location not available" under the photo', 'Turn on location. The photo is still saved without it.'],
          ['Entries stuck in "Saved on this phone"', <>Get signal and tap <b>Send now</b>. If one says Not accepted, read the red reason.</>],
          ['Shipment timer shows "Not arrived yet"', <>Tap <b>Train has arrived — start timer</b>, or load the first truck.</>],
          ['I cannot close a shipment', 'Some trucks from it are still on the road. Receive them first.'],
        ]}
      />
    ),
  },
];

/** Sections a person may see. Owner sees all; logged-out visitors see only 'all' sections. */
export function sectionsFor(role) {
  if (role === OWNER) return HELP_SECTIONS;
  return HELP_SECTIONS.filter((s) => s.roles === 'all' || (role && s.roles.includes(role)));
}
