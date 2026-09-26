#!/usr/bin/env python3
"""Generates migrations/0002_seed_content.sql. Copy is taken from the current Wix site.
Run: python3 scripts/gen-seed.py  (only before the first production migrate; after that,
content lives in D1 and is edited in the admin)."""
import json, pathlib

BOOK = 'https://5rsuites.holidayfuture.com'
ADDRESS = 'Tacoma, WA, US · Redmond, WA, US · Seattle, WA, US'
PHONE = '360-320-6166'
EMAIL = 'info@5rsuites.com'

def hero(heading, variant='title', **kw):
    d = dict(variant=variant, eyebrow='', heading=heading, subheading='', image=None,
             cta_label='', cta_url='', secondary_label='', secondary_url='')
    d.update(kw); return ('hero', d)
def text(heading, body, **kw):
    d = dict(heading=heading, body=body, image=None, image_side='right', background='white',
             align='left', button_label='', button_url='')
    d.update(kw); return ('rich_text', d)
def cards(heading, items, **kw):
    d = dict(heading=heading, intro='', background='white',
             items=[dict(title=t, description=desc, image=None) for t, desc in items])
    d.update(kw); return ('traveler_grid', d)
def banner(heading, **kw):
    d = dict(heading=heading, body='', button_label='', button_url='', tone='gold', image=None, size='normal')
    d.update(kw); return ('cta_banner', d)
def quote(q, **kw):
    d = dict(quote=q, attribution='', role='', tone='brown'); d.update(kw); return ('quote', d)
def contact(**kw):
    d = dict(heading='Contact Info', address=ADDRESS, phone=PHONE, email=EMAIL, hours='', style='brown', map_query='')
    d.update(kw); return ('contact_strip', d)
def form(which, heading, intro=''):
    return ('form', dict(form=which, heading=heading, intro=intro))

INTRO = ('5R Suites offers modern and elegantly designed accommodations for extended stays. Business and leisure '
         'travellers enjoy our fully equipped and furnished Suites that have been hand-picked from premium communities '
         'for quality and security. Experience the city as a local while enjoying the comforts of home. We work together '
         'to make your most valuable resources feel right at home.')

AMENITIES = [('workspace','Tastefully Furnished'),('wifi','In-Unit Workspace + WiFi'),('calendar','Contemporary Design'),
  ('linens','Luxury Bath Amenities'),('kitchen','Fully Equipped Kitchen'),('laundry','In-Unit Washer + Dryer'),
  ('parking','Parking Available'),('support','24-Hour Virtual Concierge'),('utilities','Air Conditioning + Heating'),
  ('security','Seamless Check-In Experience'),('tv','TV + Free Streaming (Netflix, Hulu, etc.)'),('cleaning','Housekeeping Available')]

pages = [
 (1, 'home', 'Home', 'Luxury fully-furnished apartments for extended stays in the Pacific Northwest — for business travelers, travel nurses, relocations and more.', 0, [
   hero('Design Your Stay', 'full', eyebrow='4 DAYS. 30 DAYS. 450 DAYS. YOUR CHOICE.', subheading=INTRO,
        cta_label='Book Now', cta_url=BOOK, secondary_label='Learn More', secondary_url='/about'),
   cards('Ideal Choice For', [('Vacation Travelers',''),('Travel Nurses',''),('Corporate Travelers',''),
         ('Military Travelers',''),('Insurance',''),('Relocations','')]),
   banner('PNW', body='Pacific Northwest', button_label='Book Now', button_url=BOOK, tone='photo', size='large'),
   text('Home Living With Apartment Amenities',
        'Maximize your experience at 5R Suites by utilizing your building’s amenities: pools, spas, fitness centres/gyms, '
        'conference rooms, game rooms, clubhouses, and more. No more over-crowded jacuzzis or waiting to use the treadmill. '
        'Use the amenities like any resident - because you are one!', button_label='Register Property', button_url='/register-property'),
   quote('There’s nothing quite like a change in perspective.'),
   ('amenity_grid', dict(heading='Thoughtfully Designed, Private Apartments',
        intro='Each Suite is designed for the business and leisure traveler alike; always with your lifestyle in mind. Enjoy '
              'the benefits of a fully equipped kitchen, washer + dryer in-unit, ample privacy, and space often 2X the size '
              'of a traditional hotel room; 5R Suites is the perfect alternative to an overpriced hotel room.',
        items=[dict(icon=i, label=l, description='') for i, l in AMENITIES])),
   banner('Building, Owners & Developers', body='We offer buildings an opportunity to diversify inventory and maximize '
          'profitability using our streamlined processes and technology.', button_label='Partner With Us', button_url='/partners'),
   contact(),
 ]),
 (2, 'about', 'About', 'About 5R Suites — a veteran-owned provider of luxury fully-furnished apartments for extended stays.', 10, [
   hero('About Us'),
   text('Redefining Hospitality.', INTRO + ' At 5R Suites, we’re on a mission to set the standard of excellence in travel '
        'solutions and guest experiences.', align='center', button_label='Book Now', button_url=BOOK),
   text('Our Mission', 'Our Mission is to provide a premium stress-free experience for the travelling professional needing '
        'flexible term stays where every detail matters. We are dedicated to delivering remarkable service through accessible, '
        'streamlined booking and check-in processes, elegantly fully-furnished units, and around-the-clock customer service.',
        image_side='left', button_label='Register Property', button_url='/register-property'),
   text('Our Start', 'After transitioning out of the army after 5 years of service, our CEO and Founder, Jeff Kim began to '
        'manage a small handful of apartments via Airbnb. He personally furnished each unit, moved in furniture, greeted guests '
        'with wine and walkthroughs and started to picture a new standard of corporate travel.\n\nOver the next few years, Jeff '
        'transitioned from Airbnb to creating 5R Suites to provide travelers with more value, flexibility, and security. Through '
        'developing lasting relationships with guests, building managers and property owners, and employees, 5R Suites has '
        'grown exponentially since that first unit set-up in 2017.', background='gold', align='center',
        button_label='Become Our Partner', button_url='/partners'),
   text('5R Suites Now', '5R Suites is Tacoma-based with additional locations in Redmond, WA and San Mateo, CA.\n\n'
        '- 100,000+ nights booked\n- Average 4.9-star review\n- Renovating 10 unit building, estimated opening in 2022',
        button_label='Contact Us', button_url='/contact'),
   text('Careers', 'We are always on the lookout for reliable, motivated individuals to join the 5R Suites team.\n\n'
        '### Work with us\nAre you interested in property management? Have experience in real estate, customer service, '
        'hospitality, or sales? Handy? Self-starter? Looking for a flexible schedule? Let us know! We will get back to you with '
        'any opportunities.\n\n### DOD paid internships\nAs a veteran-owned company, we offer exclusive paid internship '
        'opportunities through the DOD SkillBridge and Hiring Our Heroes programs. Message us to learn more.\n\n'
        '### Partner with us\nBuilding owner or developer? For information on partnerships check out [our Partners page](/partners).\n\n'
        'Fill out the form below or email us directly at [Careers@5RSuites.com](mailto:Careers@5RSuites.com).'),
   form('careers', 'Fill The Career Form'),
 ]),
 (3, 'register-property', 'Register Property', 'List your property with 5R Suites and receive a free short-term rental market report.', 20, [
   hero('Register Property'),
   form('register_property', 'Landlord Information'),
 ]),
 (4, 'partners', 'Partners', 'Partner with 5R Suites — guaranteed monthly income, committed insurance and no vacancies.', 30, [
   hero('Partner With Us'),
   text('Your Dream Tenant', '- **Proven Payments:** Guaranteed monthly income; on time, every time. Incredibly strong balance '
        'sheet and large operating account. NO deferments or late payments during COVID-19.\n- **Committed Insurance:** All 5R '
        'Suites units are covered through commercial-grade $2 million premises liability and $6 million excess liability coverage.\n'
        '- **No Vacancies:** Immediately lease-up units. Say goodbye to vacancies, turnover, lease commissions, and credit loss.',
        button_label='Contact Us', button_url='/contact'),
   cards('', [('Tech Enabled', 'We fund connected home improvements. All of 5R Suites technology must enhance both the guest '
          'experience and our ability to monitor and control safety and security. From noise monitoring to home automation, we '
          'combine technology with hospitality.'),
         ('Serving the Community', 'Our Suites cater to professional clientele consisting of: travel nurses, corporate sponsored '
          'workers, university professors, and government/military personnel on official orders.'),
         ('Dedicated to Safety', '5R Suites utilizes a strict verification process and fraud prevention system to ensure all guests '
          'are fully vetted. We also cross-reference guests across industry blacklists and use machine-learning software to '
          'enhance our background checks.')], background='cream'),
   quote('5R Suites is nothing short of excellent. From on-time payments to being completely accommodating and friendly all '
         'around, it is a pleasure working with them!', attribution='Napoleon Apartments', tone='white'),
   ('image_gallery', dict(heading='Our Partners', variant='logo_strip', images=[])),
 ]),
 (5, 'faq', 'FAQ', 'Frequently asked questions about booking a 5R Suites apartment and partnering with 5R Suites.', 40, [
   hero('Frequently Asked Question'),
   ('faq_list', dict(heading='FAQs - Corporate Suites Nationwide', subheading='', category='', limit=0)),
 ]),
 (6, 'contact', 'Contact', 'Contact 5R Suites — Tacoma, Redmond and Seattle, WA. Phone 360-320-6166.', 50, [
   hero('Get In Touch'),
   contact(style='white', map_query='Tacoma, WA'),
   form('contact', 'Contact Us'),
 ]),
]

FAQS = [
 ('What Types Of Properties Do You Offer?', 'Booking'),
 ('What Is Included In The Rent?', 'Booking'),
 ('How Do I Make A Reservation?', 'Booking'),
 ('How Do I Partner With 5R Suites?', 'Partners'),
]

q = lambda s: "'" + str(s).replace("'", "''") + "'"
out = ['-- GENERATED by scripts/gen-seed.py — starter content taken from the current Wix site.',
       '-- Photos are not included (upload them in the admin Media library, then pick them in each section).',
       '-- The Partners page is seeded because it exists on the current site; whether it stays is an open',
       '-- question for the client (see CLAUDE.md). Delete it in the admin if it is out.', '']
out.append('INSERT INTO pages (id, slug, title, meta_description, show_in_nav, nav_order) VALUES')
out.append(',\n'.join(f'  ({i}, {q(slug)}, {q(t)}, {q(m)}, 1, {o})' for i, slug, t, m, o, _ in pages) + ';\n')
rows = []
for i, *_rest, secs in pages:
    for pos, (typ, data) in enumerate(secs):
        rows.append(f'  ({i}, {pos}, {q(typ)}, json({q(json.dumps(data, ensure_ascii=False))}))')
out.append('INSERT INTO sections (page_id, position, type, data) VALUES\n' + ',\n'.join(rows) + ';\n')
out.append('INSERT INTO faq_items (question, answer, category, position) VALUES\n' + ',\n'.join(
    f'  ({q(qq)}, {q("Answer coming soon — replace this in the admin under FAQ.")}, {q(c)}, {n})' for n, (qq, c) in enumerate(FAQS)) + ';\n')
pathlib.Path(__file__).resolve().parent.parent.joinpath('migrations/0002_seed_content.sql').write_text('\n'.join(out))
print('wrote migrations/0002_seed_content.sql')
