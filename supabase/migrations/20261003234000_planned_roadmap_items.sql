-- Planned product-direction items for the shared Appens fremtid roadmap.
-- Skips a title if it is already present.

INSERT INTO public.app_roadmap_items (title, body, status, sort_order)
SELECT v.title, v.body, 'planned', v.sort_order
FROM (
  VALUES
    (
      'Valgomat med partisammenligning',
      'Sammenlign holdningene dine med partiene når ekte stemmedata per parti fra Stortinget er på plass.',
      20
    ),
    (
      'Sporing av valgløfter',
      'Følg hva partiene lovet, og hvordan de stemmer i Stortinget etter valget.',
      21
    ),
    (
      'Lokale saker fra kommune og fylke',
      'Saker og avstemninger fra kommune og fylke, i tillegg til Stortinget.',
      22
    ),
    (
      'Åpen innsikt når nok anonyme stemmer er samlet',
      'Offentlige anonyme stemmetall vises når saken har minst 50 stemmer.',
      23
    )
) AS v(title, body, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_roadmap_items existing
  WHERE existing.title = v.title
);
