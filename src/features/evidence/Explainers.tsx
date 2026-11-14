import { Card } from '../../ui'

const SOURCE_TERMS: { term: string; meaning: string }[] = [
  { term: 'NASA observed', meaning: 'A value retrieved from a NASA service when you use the app. FarmWise does not use this label yet.' },
  { term: 'NASA offline snapshot', meaning: 'A NASA record downloaded once and saved with the app. It works without a network and shows its retrieval date.' },
  { term: 'Simulated sensor', meaning: 'A made-up soil reading used to show how sensors would appear. It is not measured on any field.' },
  { term: 'Farmer input', meaning: 'Something you typed in, such as your crops or notes. FarmWise does not check it.' },
  { term: 'Your soil test', meaning: 'Results you entered from a soil test of your own field.' },
  { term: 'Demo example', meaning: 'A sample photo or case prepared for the demonstration. It is not about your plants.' },
  { term: 'Model estimate', meaning: 'A number worked out by FarmWise from other inputs and stated assumptions. It is an estimate, not an observation.' },
]

export function HowToRead() {
  return (
    <div className="ev-grid">
      <Card title="What the source labels mean" headingLevel={3}>
        <dl className="ev-terms">
          {SOURCE_TERMS.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Satellite data and soil readings are different scales" headingLevel={3} className="ev-prose">
        <p>
          NASA POWER values describe an area of roughly 0.5° by 0.625° of latitude and longitude, which
          is tens of kilometres across. Each value is an average for that whole grid cell, built from
          satellite and weather-model data.
        </p>
        <p>
          A soil test or a sensor in the ground describes one spot in one field. The two can differ a
          lot, so regional climate data cannot replace a soil test.
        </p>
      </Card>

      <Card title="Score and confidence are separate" headingLevel={3} className="ev-prose">
        <p>
          <strong>Score</strong> is a relative ranking from 0 to 100 that the rotation model gives to
          each plan, so you can compare plans for the same farm. It is not a yield or a profit.
        </p>
        <p>
          <strong>Confidence</strong> (low, medium or high) says how complete and reliable the inputs
          behind a score are. A high score with low confidence means the ranking rests on thin data.
          Read the two side by side.
        </p>
      </Card>

      <Card title="Past data, not a prediction" headingLevel={3} className="ev-prose">
        <p>
          The charts show rainfall and temperature that already happened. They describe what this
          region has been like. They are not a weather forecast for tomorrow or for next season.
        </p>
        <p>
          FarmWise does not diagnose plant disease. Photos and climate can point to a possible concern
          that is worth checking locally with an extension officer or agronomist.
        </p>
      </Card>
    </div>
  )
}

const LIMITATIONS: string[] = [
  'Grid averaging: each value is an average over a grid cell of about 0.5° by 0.625°. Hills, lakes and your own field can differ from it.',
  'Blended source: temperature and rainfall come from a reanalysis model (MERRA-2) that assimilates satellite and other observations. They are estimates, not readings from a rain gauge on your farm.',
  'No field check: these numbers have not been compared with measurements from your field.',
  'Monthly detail only: monthly means hide dry spells, heavy storms and the timing within a month.',
  'Data gaps: a missing month is shown as Unknown. A year with any missing month has no annual total.',
  'One location: the snapshot covers one demonstration point. Farms far from it see the nearest snapshot, with the distance noted.',
]

export function Limitations() {
  return (
    <Card title="Known limits of this data" headingLevel={3}>
      <ul className="ev-list">
        {LIMITATIONS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Card>
  )
}
