alter table public.tools
  add column if not exists price_per_day numeric default 0;

alter table public.tools
  add column if not exists maintenance boolean default false;

insert into public.tools (
  name,
  category,
  price,
  price_per_day,
  deposit,
  max_days,
  image_url,
  description,
  media_urls,
  busydates,
  is_available,
  maintenance
)
select
  v.name,
  'כלי עבודה'::text as category,
  400::numeric as price,
  400::numeric as price_per_day,
  3000::numeric as deposit,
  2::integer as max_days,
  v.image_url,
  v.description,
  array[v.image_url]::text[] as media_urls,
  '[]'::jsonb as busydates,
  true as is_available,
  false as maintenance
from (
  values
    ('מקדחת יהלום', 'מקדחה מקצועית לקידוח מדויק בבטון, בלוקים וחומרים קשים.', 'https://picsum.photos/seed/diamond-drill/600/400'),
    ('מקדחת אדמה', 'מקדחת אדמה חזקה לפתיחת בורות מהירה ונוחה בגינה ובשטח.', 'https://picsum.photos/seed/earth-drill/600/400'),
    ('קונגו', 'פטיש חציבה עוצמתי לעבודות שבירה, חציבה ושיפוץ.', 'https://picsum.photos/seed/kango-hammer/600/400'),
    ('מכונת פוליש', 'מכונת פוליש מקצועית לניקוי והברקה של רצפות ומשטחים.', 'https://picsum.photos/seed/polisher-machine/600/400'),
    ('שואב אבק תעשייתי', 'שואב תעשייתי חזק לשאיבת אבק, לכלוך ופסולת בנייה.', 'https://picsum.photos/seed/industrial-vacuum/600/400'),
    ('גנרטור', 'גנרטור אמין לספק חשמל רציף באתרי עבודה ובאירועים.', 'https://picsum.photos/seed/generator-power/600/400'),
    ('מחרצת בטון', 'מחרצת בטון מקצועית ליצירת חריצים מדויקים בתשתיות ובקירות.', 'https://picsum.photos/seed/concrete-groover/600/400'),
    ('אקדח מסמרים עם מדחס', 'ערכת אקדח מסמרים עם מדחס לעבודה מהירה, נקייה ומדויקת.', 'https://picsum.photos/seed/nail-gun-compressor/600/400'),
    ('רמפה לגובה 1.8 מטר משקל 1 טון', 'רמפה יציבה להעמסה ופריקה בטוחה עד משקל של טון.', 'https://picsum.photos/seed/loading-ramp/600/400'),
    ('פטישון נטען', 'פטישון נטען קומפקטי לעבודות קידוח וחציבה קלות בשטח.', 'https://picsum.photos/seed/cordless-rotary-hammer/600/400'),
    ('מדחס אויר', 'מדחס אוויר איכותי להפעלת כלים פנאומטיים וניפוח מהיר.', 'https://picsum.photos/seed/air-compressor/600/400'),
    ('מכונה לחידוש דקים', 'מכונה ייעודית לניקוי, שיוף וחידוש דקים ומשטחי עץ.', 'https://picsum.photos/seed/deck-renewal-machine/600/400'),
    ('משאבת טבילה', 'משאבת טבילה חזקה לניקוז מים מבורות, מרתפים ואזורים מוצפים.', 'https://picsum.photos/seed/submersible-pump/600/400'),
    ('משאבת מים', 'משאבת מים רב-שימושית להעברת מים, השקיה ועבודות כלליות.', 'https://picsum.photos/seed/water-pump/600/400')
) as v(name, description, image_url)
where not exists (
  select 1
  from public.tools t
  where lower(t.name) = lower(v.name)
);
