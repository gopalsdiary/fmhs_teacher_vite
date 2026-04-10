# শিক্ষার্থী অ্যাপ (Student App) মেসেজিং ইন্টিগ্রেশন গাইড

এই গাইডটি অনুসরণ করে আপনি আপনার শিক্ষার্থীর অ্যাপে টিচারদের সাথে চ্যাট করার অপশন যুক্ত করতে পারবেন। এটি মূল টিচার রিলেটেড ডাটাবেস এবং মেসেজিং ডাটাবেস উভয়ের সাথে কানেক্ট হবে।


CREATE TABLE fmhs_attendance_notification_settings (
    teacher_email text NOT NULL,
    teacher_name text,
    target_class text NOT NULL,
    target_section text NOT NULL,
    msg_template_text text DEFAULT 'সম্মানিত অভিভাবক, আপনার সন্তান {name} (রোল: {roll}) আজ বিদ্যালয়ে অনুপস্থিত।',
    start_time time DEFAULT '09:30',
    end_time time DEFAULT '11:30',
    is_enabled boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (teacher_email, target_class, target_section)
);



## ১. এনভায়রনমেন্ট সেটআপ (.env)
আপনার শিক্ষার্থীর অ্যাপের `.env` ফাইলে নিচের দুটি কি যোগ করুন (যদি আগে থেকে না থাকে):

```env
# মেইন ডাটাবেস (যেখানে student_database এবং teacher_database আছে)
# মেসেজিং ডাটাবেস (যেখানে মেসেজ সেভ হবে)

VITE_SUPABASE_URL=https://rtfefxghfbtirfnlbucb.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZmVmeGdoZmJ0aXJmbmxidWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDg3OTcsImV4cCI6MjA1NjA4NDc5N30.fb7_myCmFzbV7WPNjFN_NEl4z0sOmRCefnkQbk6c10w

VITE_SUPABASE_MSG_URL=https://vbfckjroisrhplrpqzkd.supabase.co
VITE_SUPABASE_MSG_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y


## ২. সুপাবেস ক্লায়েন্ট কনফিগারেশন
শিক্ষার্থী অ্যাপে দুটি সুপাবেস ক্লায়েন্ট তৈরি করতে হবে:

```javascript
import { createClient } from '@supabase/supabase-js'

// মেইন ডাটাবেস
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

// মেসেজিং ডাটাবেস
const msgSupabase = createClient(
  import.meta.env.VITE_SUPABASE_MSG_URL,
  import.meta.env.VITE_SUPABASE_MSG_KEY
)
```

## ৩. গুরুত্বপূর্ণ লজিক্যাল স্টেপস

### ক. অনলাইন স্ট্যাটাস (Presence Heartbeat)
শিক্ষার্থী যখন অ্যাপে ওপেন করবে, তখন তার `iid` দিয়ে অনলাইন স্ট্যাটাস আপডেট করতে হবে।
```javascript
const updatePresence = async (studentIid) => {
  await msgSupabase.from('teacher_presence').upsert({
    email: studentIid.toString(), // email কলামে শিক্ষার্থীর iid সেভ হবে
    last_seen: new Date().toISOString(),
    status: 'online'
  });
};
```

### খ. মেসেজিং ব্লক করা আছে কিনা যাচাই (Disallow Check)
মেসেজ পাঠানোর আগে অবশ্যই চেক করতে হবে টিচার শিক্ষার্থীকে ব্লক করেছেন কিনা।
```javascript
const checkAccess = async (studentIid) => {
  const { data } = await msgSupabase
    .from('student_messaging_status')
    .select('is_disabled')
    .eq('student_iid', studentIid)
    .single();
  
  if (data?.is_disabled) {
    alert("আপনার মেসেজ পাঠানোর সুবিধাটি শিক্ষক বন্ধ করে রেখেছেন।");
    return false;
  }
  return true;
};
```

### গ. মেসেজ সেভ করা
মেসেজ সেভ করার সময় `sender_type` হবে `'student'`।
```javascript
const sendMessage = async (studentIid, teacherEmail, msgText) => {
  const { error } = await msgSupabase
    .from('fmhs_student_messages')
    .insert({
      student_iid: studentIid,
      teacher_email: teacherEmail,
      message: msgText,
      sender_type: 'student'
    });
};
```

## ৪. ইউজার ইন্টারফেস (UI Design)
ফেসবুক মেসেঞ্জারের মতো ডিজাইন পেতে নিচের ইন্সট্রাকশন ফলো করুন:
- **Header:** ফেসবুক ব্লু কালার (#1877F2)।
- **Chat Bubbles:** শিক্ষার্থীর (নিজের) মেসেজ হবে হালকা ধূসর (#E4E6EB) এবং টিচারের মেসেজ হবে ফেসবুক ব্লু (#1877F2)।
- **Avatars:** শিক্ষার্থীদের জন্য গোল প্রোফাইল সার্কেল।
- **Font:** Segoe UI বা আধুনিক ফন্ট ব্যবহার করুন।

## ৫. সিকিউরিটি (SQL)
আপনার মেসেজিং সুপাবেসে (vbfck...) এই টেবিলগুলো এবং পারমিশনগুলো থাকতে হবে:
- `fmhs_student_messages` - সকল মেসেজ স্টোর করবে।
- `student_messaging_status` - শিক্ষার্থী ব্লক করা আছে কিনা ট্র্যাক করবে।
- `teacher_presence` - অনলাইন স্ট্যাটাস ট্র্যাক করবে।

---
**টিপস:** শিক্ষার্থী অ্যাপে টিচারদের লিস্ট দেখানোর সময় `teacher_database` থেকে সব টিচারকে দেখাবেন যাতে শিক্ষার্থী যেকোনো টিচারকে মেসেজ পাঠাতে পারে।
