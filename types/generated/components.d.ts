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

export interface SharedCustomVideoRecording extends Struct.ComponentSchema {
  collectionName: 'components_shared_custom_video_recordings';
  info: {
    displayName: 'custom_video_recording';
  };
  attributes: {
    materials: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    video_content: Schema.Attribute.Component<'shared.video-content', true>;
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

export interface SharedLessonContent extends Struct.ComponentSchema {
  collectionName: 'components_shared_lesson_contents';
  info: {
    displayName: 'lesson_content';
  };
  attributes: {
    content_title: Schema.Attribute.String & Schema.Attribute.Required;
    hours: Schema.Attribute.Integer;
    minutes: Schema.Attribute.Integer;
    seconds: Schema.Attribute.Integer;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedMaterials extends Struct.ComponentSchema {
  collectionName: 'components_shared_materials';
  info: {
    displayName: 'materials';
  };
  attributes: {
    materials: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
  };
}

export interface SharedMiniCourseLanding extends Struct.ComponentSchema {
  collectionName: 'components_shared_mini_course_landings';
  info: {
    displayName: 'mini_course_landing';
  };
  attributes: {
    banner_description: Schema.Attribute.String & Schema.Attribute.Required;
    program_content: Schema.Attribute.Component<
      'shared.program-content',
      false
    >;
  };
}

export interface SharedMiniCourseLesson extends Struct.ComponentSchema {
  collectionName: 'components_shared_mini_course_lessons';
  info: {
    displayName: 'mini_course_lesson';
  };
  attributes: {
    lesson_content: Schema.Attribute.Component<'shared.lesson-content', true>;
    lesson_tite: Schema.Attribute.String & Schema.Attribute.Required;
    materials: Schema.Attribute.Component<'shared.materials', true>;
  };
}

export interface SharedProgramContent extends Struct.ComponentSchema {
  collectionName: 'components_shared_program_contents';
  info: {
    displayName: 'program_content';
  };
  attributes: {
    content_description: Schema.Attribute.RichText & Schema.Attribute.Required;
    content_title: Schema.Attribute.String & Schema.Attribute.Required;
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

export interface SharedUpcomingSession extends Struct.ComponentSchema {
  collectionName: 'components_shared_upcoming_sessions';
  info: {
    displayName: 'upcoming_session';
  };
  attributes: {
    stream_date: Schema.Attribute.Date & Schema.Attribute.Required;
    stream_time: Schema.Attribute.Time & Schema.Attribute.Required;
    stream_url: Schema.Attribute.String & Schema.Attribute.Required;
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

export interface SharedVideoContent extends Struct.ComponentSchema {
  collectionName: 'components_shared_video_contents';
  info: {
    displayName: 'video_content';
  };
  attributes: {
    content_title: Schema.Attribute.String & Schema.Attribute.Required;
    hours: Schema.Attribute.Integer;
    minutes: Schema.Attribute.Integer;
    seconds: Schema.Attribute.Integer;
    url: Schema.Attribute.String & Schema.Attribute.Required;
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
      'shared.custom-video-recording': SharedCustomVideoRecording;
      'shared.image': SharedImage;
      'shared.ipk': SharedIpk;
      'shared.lesson-content': SharedLessonContent;
      'shared.materials': SharedMaterials;
      'shared.mini-course-landing': SharedMiniCourseLanding;
      'shared.mini-course-lesson': SharedMiniCourseLesson;
      'shared.program-content': SharedProgramContent;
      'shared.seo': SharedSeo;
      'shared.text': SharedText;
      'shared.upcoming-session': SharedUpcomingSession;
      'shared.useful-files': SharedUsefulFiles;
      'shared.video-content': SharedVideoContent;
      'shared.video-review': SharedVideoReview;
      'shared.zakon': SharedZakon;
      'shared.zrazok': SharedZrazok;
    }
  }
}
