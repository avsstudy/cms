import type { Schema, Struct } from '@strapi/strapi';

export interface SharedChapter extends Struct.ComponentSchema {
  collectionName: 'components_shared_chapters';
  info: {
    displayName: 'Chapter';
    icon: 'bulletList';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    startSeconds: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface SharedContent extends Struct.ComponentSchema {
  collectionName: 'components_shared_contents';
  info: {
    displayName: 'content';
  };
  attributes: {
    text: Schema.Attribute.Blocks;
  };
}

export interface SharedCustomTable extends Struct.ComponentSchema {
  collectionName: 'components_shared_custom_tables';
  info: {
    displayName: 'custom-table';
    icon: 'apps';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    headers: Schema.Attribute.JSON;
    rows: Schema.Attribute.JSON;
    title: Schema.Attribute.String;
    tocTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
  };
}

export interface SharedCustomVideo extends Struct.ComponentSchema {
  collectionName: 'components_shared_custom_videos';
  info: {
    displayName: 'custom-video';
  };
  attributes: {
    chapters: Schema.Attribute.Component<'shared.chapter', true>;
    materials: Schema.Attribute.Media<'files', true>;
    provider: Schema.Attribute.Enumeration<['youtube', 'vimeo']>;
    url: Schema.Attribute.String;
  };
}

export interface SharedImage extends Struct.ComponentSchema {
  collectionName: 'components_shared_images';
  info: {
    displayName: 'Image';
    icon: 'crop';
  };
  attributes: {
    image: Schema.Attribute.Media<'images' | 'files'>;
  };
}

export interface SharedJson extends Struct.ComponentSchema {
  collectionName: 'components_shared_jsons';
  info: {
    displayName: 'json';
  };
  attributes: {
    json: Schema.Attribute.JSON;
  };
}

export interface SharedMark extends Struct.ComponentSchema {
  collectionName: 'components_shared_marks';
  info: {
    displayName: 'mark';
  };
  attributes: {
    mark: Schema.Attribute.RichText;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRelated extends Struct.ComponentSchema {
  collectionName: 'components_shared_relateds';
  info: {
    displayName: 'related';
  };
  attributes: {
    article: Schema.Attribute.Relation<'oneToOne', 'api::article.article'>;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

export interface SharedText extends Struct.ComponentSchema {
  collectionName: 'components_shared_texts';
  info: {
    displayName: 'Text';
    icon: 'pencil';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    content: Schema.Attribute.Blocks;
    tocTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
  };
}

export interface SharedVideo extends Struct.ComponentSchema {
  collectionName: 'components_shared_videos';
  info: {
    displayName: 'video';
  };
  attributes: {
    video: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.chapter': SharedChapter;
      'shared.content': SharedContent;
      'shared.custom-table': SharedCustomTable;
      'shared.custom-video': SharedCustomVideo;
      'shared.image': SharedImage;
      'shared.json': SharedJson;
      'shared.mark': SharedMark;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.related': SharedRelated;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
      'shared.text': SharedText;
      'shared.video': SharedVideo;
    }
  }
}
