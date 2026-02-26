// Required tool names for grading: generateImage, plot_metric_vs_time, play_video, compute_stats_json

export const YOUTUBE_JSON_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt and an optional anchor/reference image. The user can provide an image to use as style or content reference. Use this when the user asks to generate, create, or draw an image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Detailed text description of the image to generate.',
        },
        anchor_image_base64: {
          type: 'STRING',
          description: 'Optional. Base64-encoded reference image for style or content guidance.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Flexible plotting: (A) metric(s) vs time: use metric_fields. (B) X vs Y scatter (e.g. likes on x, views on y): use x_field and y_field. Fields: viewCount, likeCount, commentCount, likesPer1000Views, commentsPer1000Views. Use max_videos to limit.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric_fields: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'For time-series: one or more metrics vs time.',
        },
        metric_field: {
          type: 'STRING',
          description: 'Legacy: single metric vs time.',
        },
        x_field: {
          type: 'STRING',
          description: 'For scatter: metric on x-axis (e.g. likeCount for likes on x).',
        },
        y_field: {
          type: 'STRING',
          description: 'For scatter: metric on y-axis (e.g. viewCount for views on y).',
        },
        max_videos: {
          type: 'NUMBER',
          description: 'Optional. Limit to N videos. Omit for all.',
        },
      },
      required: [],
    },
  },
  {
    name: 'play_video',
    description:
      'Open or play a YouTube video from the loaded channel data. The user can specify by title (e.g. "the asbestos video"), ordinal (e.g. "first", "second", "third", "4th", "#3"), "latest" (first/newest), "last", or "most viewed". Display a clickable card with title and thumbnail that opens the video in a new tab.',
    parameters: {
      type: 'OBJECT',
      properties: {
        specifier: {
          type: 'STRING',
          description: 'How to pick: "first", "last", "latest", "#N" (e.g. #3), "most viewed", or substring of video title.',
        },
      },
      required: ['specifier'],
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute mean, median, std (standard deviation), min, and max for any numeric field in the loaded YouTube channel JSON (e.g. viewCount, likeCount, commentCount). Use when the user asks for statistics, average, or distribution of a numeric column.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description: 'Exact numeric field name from the channel JSON, e.g. viewCount, likeCount, commentCount.',
        },
      },
      required: ['field'],
    },
  },
];

const FIELD_ALIASES = {
  views: 'viewCount',
  view: 'viewCount',
  view_count: 'viewCount',
  likes: 'likeCount',
  like: 'likeCount',
  like_count: 'likeCount',
  comments: 'commentCount',
  comment: 'commentCount',
  comment_count: 'commentCount',
  likes_per_1000_views: 'likesPer1000Views',
  likesper1000views: 'likesPer1000Views',
  comments_per_1000_views: 'commentsPer1000Views',
  commentsper1000views: 'commentsPer1000Views',
};

const COMPUTED_FIELDS = new Set(['likesPer1000Views', 'commentsPer1000Views']);

function getValueForField(video, field) {
  if (field === 'likesPer1000Views') {
    const v = parseFloat(video.viewCount);
    const l = parseFloat(video.likeCount);
    if (!v || v <= 0 || isNaN(l)) return NaN;
    return (l / v) * 1000;
  }
  if (field === 'commentsPer1000Views') {
    const v = parseFloat(video.viewCount);
    const c = parseFloat(video.commentCount);
    if (!v || v <= 0 || isNaN(c)) return NaN;
    return (c / v) * 1000;
  }
  return parseFloat(video[field]);
}

function resolveFieldName(field, numericFields) {
  const f = (field || '').trim();
  const alias = FIELD_ALIASES[f.toLowerCase()];
  const target = alias || f;
  return (
    numericFields.find((k) => k.toLowerCase() === target.toLowerCase()) || target
  );
}

function numericValues(arr, field) {
  return arr.map((o) => parseFloat(o[field])).filter((v) => !isNaN(v));
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function executeYoutubeJsonTool(toolName, args, videos, options = {}) {
  if (!Array.isArray(videos) || !videos.length) {
    return { error: 'No YouTube channel data loaded. Please drag a channel JSON file into the chat first.' };
  }

  const first = videos[0];
  const numericFields = Object.keys(first).filter(
    (k) => typeof first[k] === 'number' || (typeof first[k] === 'string' && !isNaN(parseFloat(first[k])) && first[k].trim() !== '')
  );

  switch (toolName) {
    case 'compute_stats_json': {
      const rawF = (args.field || '').trim();
      const resolved = FIELD_ALIASES[rawF.toLowerCase()] || (COMPUTED_FIELDS.has(rawF) ? rawF : resolveFieldName(rawF, numericFields));
      const vals = COMPUTED_FIELDS.has(resolved)
        ? videos.map((v) => getValueForField(v, resolved)).filter((v) => !isNaN(v))
        : numericValues(videos, resolved);
      if (!vals.length) {
        return { error: `No numeric values for field "${resolved}". Try: ${numericFields.slice(0, 8).join(', ')}` };
      }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sorted = [...vals].sort((a, b) => a - b);
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      return {
        field: resolved,
        mean: +mean.toFixed(4),
        median: +median(sorted).toFixed(4),
        std: +Math.sqrt(variance).toFixed(4),
        min: Math.min(...vals),
        max: Math.max(...vals),
        count: vals.length,
      };
    }

    case 'plot_metric_vs_time': {
      const resolveOne = (f) => {
        const alias = FIELD_ALIASES[(f || '').toLowerCase()];
        if (alias) return alias;
        if (COMPUTED_FIELDS.has(f)) return f;
        return numericFields.find((k) => k.toLowerCase() === (f || '').toLowerCase()) || f;
      };

      const xRaw = (args.x_field || '').trim();
      const yRaw = (args.y_field || '').trim();
      if (xRaw && yRaw) {
        const xField = resolveOne(xRaw);
        const yField = resolveOne(yRaw);
        const maxVideos = args.max_videos != null ? Math.max(1, Math.min(Math.floor(Number(args.max_videos)), videos.length)) : null;
        let subset = videos;
        if (maxVideos != null) {
          const byDate = [...videos].sort((a, b) => new Date(b.releaseDate || b.publishedAt || 0) - new Date(a.releaseDate || a.publishedAt || 0));
          subset = byDate.slice(0, maxVideos);
        }
        const points = subset
          .map((v) => {
            const x = COMPUTED_FIELDS.has(xField) ? getValueForField(v, xField) : parseFloat(v[xField]);
            const y = COMPUTED_FIELDS.has(yField) ? getValueForField(v, yField) : parseFloat(v[yField]);
            if (isNaN(x) || isNaN(y)) return null;
            return { x, y, label: (v.title || '').slice(0, 40) };
          })
          .filter((p) => p != null);
        if (!points.length) {
          return { error: `No valid x/y data for ${xField} vs ${yField}.` };
        }
        return {
          _chartType: 'scatter',
          xField,
          yField,
          data: { points },
        };
      }

      let rawFields = [];
      if (Array.isArray(args.metric_fields) && args.metric_fields.length) {
        rawFields = args.metric_fields.map((f) => (typeof f === 'string' ? f : String(f)));
      } else if (typeof args.metric_field === 'string' && args.metric_field.trim()) {
        rawFields = [args.metric_field.trim()];
      } else if (typeof args.metric_fields === 'string' && args.metric_fields.trim()) {
        rawFields = args.metric_fields.split(/[,\s]+/).map((f) => f.trim()).filter(Boolean);
      }
      const resolvedFields = rawFields.map((f) => resolveOne(f));
      if (!resolvedFields.length) {
        return { error: `Specify metric_field, metric_fields, or x_field+y_field for scatter. Raw: ${numericFields.slice(0, 8).join(', ')}. Computed: likesPer1000Views, commentsPer1000Views.` };
      }
      const maxVideos = args.max_videos != null ? Math.max(1, Math.min(Math.floor(Number(args.max_videos)), videos.length)) : null;
      let subset = videos;
      if (maxVideos != null) {
        const byDate = [...videos].sort((a, b) => new Date(b.releaseDate || b.publishedAt || 0) - new Date(a.releaseDate || a.publishedAt || 0));
        subset = byDate.slice(0, maxVideos);
      }
      const withDate = subset
        .map((v) => {
          const row = { date: v.releaseDate || v.publishedAt || '' };
          for (const rf of resolvedFields) {
            row[rf] = COMPUTED_FIELDS.has(rf) ? getValueForField(v, rf) : parseFloat(v[rf]);
          }
          return row;
        })
        .filter((d) => d.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const hasValues = (d) => resolvedFields.some((rf) => !isNaN(d[rf]));
      const valid = withDate.filter(hasValues);
      if (!valid.length) {
        return { error: `No date/value data for ${resolvedFields.join(', ')}. Try: ${numericFields.slice(0, 8).join(', ')}` };
      }
      const labels = valid.map((d) => d.date.slice(0, 10));
      const series = resolvedFields.map((rf) => ({
        field: rf,
        values: valid.map((d) => d[rf]),
      }));
      const data = { labels, series };
      return {
        _chartType: 'metric_vs_time',
        fields: resolvedFields,
        data,
      };
    }

    case 'play_video': {
      const raw = (args.specifier || '').trim();
      const spec = raw.toLowerCase();
      const WORD_ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
      const clean = spec.replace(/^(the|play|open)\s+/, '').replace(/\s+video$/i, '').trim();
      const ordWord = WORD_ORD[clean] ?? WORD_ORD[spec.replace(/\s+video$/i, '')];
      const ordNumMatch = spec.match(/\b(\d+)(st|nd|rd|th)?\b/);
      let chosen = null;
      if (ordWord != null) {
        chosen = videos[ordWord - 1] ?? videos[0];
      } else if (ordNumMatch) {
        const idx = Math.max(0, parseInt(ordNumMatch[1], 10) - 1);
        chosen = videos[idx] ?? videos[0];
      } else if (/^first$|^1st$/i.test(clean) || spec === 'first' || spec === '1st') {
        chosen = videos[0];
      } else if (/^last$/i.test(clean)) {
        chosen = videos[videos.length - 1];
      } else if (/^latest$/i.test(clean) || /^latest$/i.test(spec)) {
        chosen = videos[0];
      } else if (/^#(\d+)$/.test(spec.trim())) {
        const n = parseInt(spec.trim().slice(1), 10);
        chosen = videos[Math.max(0, n - 1)] ?? videos[0];
      } else if (/most\s*viewed/i.test(spec)) {
        chosen = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];
      } else if (clean || spec) {
        chosen = videos.find((v) => (v.title || '').toLowerCase().includes(clean || spec)) ?? videos[0];
      } else {
        chosen = videos[0];
      }
      if (!chosen) return { error: 'No video found.' };
      return {
        _cardType: 'play_video',
        videoUrl: chosen.videoUrl || `https://www.youtube.com/watch?v=${chosen.videoId}`,
        title: chosen.title || 'Video',
        thumbnailUrl: chosen.thumbnailUrl || `https://img.youtube.com/vi/${chosen.videoId}/mqdefault.jpg`,
      };
    }

    case 'generateImage': {
      return options.generateImageFn
        ? options.generateImageFn(args)
        : { error: 'Image generation is not configured.' };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
