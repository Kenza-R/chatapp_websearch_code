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
      'Plot any numeric field (e.g. viewCount, likeCount, commentCount) vs time for the loaded YouTube channel videos. Use when the user asks to plot, graph, or visualize a metric over time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric_field: {
          type: 'STRING',
          description: 'Exact field name from the channel JSON, e.g. viewCount, likeCount, commentCount.',
        },
      },
      required: ['metric_field'],
    },
  },
  {
    name: 'play_video',
    description:
      'Open or play a YouTube video from the loaded channel data. The user can specify by title (e.g. "the asbestos video"), ordinal (e.g. "first video", "third video"), or "most viewed". Display a clickable card with title and thumbnail that opens the video in a new tab.',
    parameters: {
      type: 'OBJECT',
      properties: {
        specifier: {
          type: 'STRING',
          description: 'How to pick the video: "first", "last", "most viewed", or a substring of the video title.',
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
};

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
      const resolved = resolveFieldName(args.field, numericFields);
      const vals = numericValues(videos, resolved);
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
      const resolved = resolveFieldName(args.metric_field, numericFields);
      const withDate = videos
        .map((v) => ({
          date: v.releaseDate || v.publishedAt || '',
          value: parseFloat(v[resolved]),
        }))
        .filter((d) => d.date && !isNaN(d.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!withDate.length) {
        return { error: `No date/value data for "${resolved}". Try: ${numericFields.slice(0, 8).join(', ')}` };
      }
      return {
        _chartType: 'metric_vs_time',
        field: resolved,
        data: {
          labels: withDate.map((d) => d.date.slice(0, 10)),
          values: withDate.map((d) => d.value),
        },
      };
    }

    case 'play_video': {
      const spec = (args.specifier || '').toLowerCase().trim();
      const WORD_ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
      let chosen = null;
      const ordWord = WORD_ORD[spec.replace(' video', '')];
      const ordNumMatch = spec.match(/\b(\d+)(st|nd|rd|th)?\b/);
      if (ordWord) {
        chosen = videos[ordWord - 1] || videos[0];
      } else if (ordNumMatch) {
        const idx = parseInt(ordNumMatch[1], 10) - 1;
        chosen = videos[idx] || videos[0];
      } else if (spec === 'first' || spec === '1st') {
        chosen = videos[0];
      } else if (spec === 'last') {
        chosen = videos[videos.length - 1];
      } else if (spec === 'most viewed') {
        chosen = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];
      } else if (spec) {
        chosen = videos.find((v) => (v.title || '').toLowerCase().includes(spec)) || videos[0];
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
