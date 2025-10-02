import type { Schema, Struct } from '@strapi/strapi';

export interface SharedBlank extends Struct.ComponentSchema {
  collectionName: 'components_shared_blanks';
  info: {
    displayName: 'blank';
  };
  attributes: {
    blank_file: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    blank_title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedChapter extends Struct.ComponentSchema {
  collectionName: 'components_shared_chapters';
  info: {
    displayName: 'Chapter';
    icon: 'bulletList';
  };
  attributes: {
    hour: Schema.Attribute.Integer;
    label: Schema.Attribute.Text & Schema.Attribute.Required;
    minute: Schema.Attribute.Integer;
    second: Schema.Attribute.Integer;
  };
}

export interface SharedCustomQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_custom_quotes';
  info: {
    displayName: 'custom-quote';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    anchor_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    text_content: Schema.Attribute.Blocks;
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
    anchor_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    description: Schema.Attribute.Text;
    headers: Schema.Attribute.JSON;
    rows: Schema.Attribute.JSON;
    title: Schema.Attribute.String;
  };
}

export interface SharedCustomVideo extends Struct.ComponentSchema {
  collectionName: 'components_shared_custom_videos';
  info: {
    displayName: 'custom-video';
  };
  attributes: {
    provider: Schema.Attribute.Enumeration<['youtube', 'vimeo']> &
      Schema.Attribute.DefaultTo<'youtube'>;
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

export interface SharedIpk extends Struct.ComponentSchema {
  collectionName: 'components_shared_ipks';
  info: {
    displayName: 'custom-ipk';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    anchor_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    text_content: Schema.Attribute.Blocks;
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

export interface SharedText extends Struct.ComponentSchema {
  collectionName: 'components_shared_texts';
  info: {
    displayName: 'Text';
    icon: 'pencil';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    anchor_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    text_content: Schema.Attribute.Blocks;
  };
}

export interface SharedUsefulFiles extends Struct.ComponentSchema {
  collectionName: 'components_shared_useful_files';
  info: {
    displayName: 'useful_files';
  };
  attributes: {
    useful_file: Schema.Attribute.Media<'files'>;
    useful_file_cover: Schema.Attribute.Media<'images'> &
      Schema.Attribute.Required;
    useful_file_title: Schema.Attribute.String & Schema.Attribute.Required;
    useful_video: Schema.Attribute.String;
  };
}

export interface SharedVideoReview extends Struct.ComponentSchema {
  collectionName: 'components_shared_video_reviews';
  info: {
    displayName: 'video-review';
  };
  attributes: {
    chapters: Schema.Attribute.Component<'shared.chapter', true> &
      Schema.Attribute.Required;
    materials: Schema.Attribute.Media<'files', true>;
    provider: Schema.Attribute.Enumeration<['youtube', 'vimeo']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'youtube'>;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedZakon extends Struct.ComponentSchema {
  collectionName: 'components_shared_zakons';
  info: {
    displayName: 'zakon';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    anchor_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    text_content: Schema.Attribute.Blocks;
  };
}

export interface SharedZrazok extends Struct.ComponentSchema {
  collectionName: 'components_shared_zrazoks';
  info: {
    displayName: 'zrazok';
  };
  attributes: {
    zrazok_file: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    zrazok_title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.blank': SharedBlank;
      'shared.chapter': SharedChapter;
      'shared.custom-quote': SharedCustomQuote;
      'shared.custom-table': SharedCustomTable;
      'shared.custom-video': SharedCustomVideo;
      'shared.image': SharedImage;
      'shared.ipk': SharedIpk;
      'shared.seo': SharedSeo;
      'shared.text': SharedText;
      'shared.useful-files': SharedUsefulFiles;
      'shared.video-review': SharedVideoReview;
      'shared.zakon': SharedZakon;
      'shared.zrazok': SharedZrazok;
    }
  }
}
