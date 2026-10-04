import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { createElement, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input } from '../../components/Input';
import { PrimaryButton } from '../../components/PrimaryButton';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '../../constants/theme';

const COUNTRIES = [
  'India',
  'United Arab Emirates',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Saudi Arabia',
  'Pakistan',
  'Bangladesh',
  'Other',
];

const LANGUAGES = [
  'English',
  'Hindi',
  'Urdu',
  'Hinglish',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Other',
];

const GENDERS = ['Male', 'Female'];

function calculateAge(date: Date) {
  const today = new Date();

  let age =
    today.getFullYear() - date.getFullYear();

  const monthDifference =
    today.getMonth() - date.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < date.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function getAgeBracket(age: number) {
  if (age < 13) return '';
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';

  return '55+';
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');
  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value
    .split('-')
    .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day,
  );
}

function getTodayDateInput() {
  return formatDateForInput(new Date());
}

function getMinimumDateInput() {
  return '1940-01-01';
}

function WebDateInput({
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate: string;
  maximumDate: string;
}) {
  const inputValue = value
    ? formatDateForInput(value)
    : '';

  return createElement('input', {
    type: 'date',
    value: inputValue,
    min: minimumDate,
    max: maximumDate,
    onChange: (
      event: {
        target: {
          value: string;
        };
      },
    ) => {
      const selectedDate =
        parseDateInput(
          event.target.value,
        );

      if (selectedDate) {
        onChange(selectedDate);
      }
    },
    style: {
      width: '100%',
      height: 52,
      boxSizing: 'border-box',
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.md,
      color: colors.primaryText,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      fontFamily: fontFamily.body,
      fontSize: fontSize.md,
      outline: 'none',
      colorScheme: 'dark',
    },
  });
}

export default function AboutScreen() {
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
  }>();

  const displayName = Array.isArray(
    params.displayName,
  )
    ? params.displayName[0]
    : params.displayName ?? '';

  const username = Array.isArray(
    params.username,
  )
    ? params.username[0]
    : params.username ?? '';

  const [country, setCountry] =
    useState('');

  const [language, setLanguage] =
    useState('');

  const [gender, setGender] =
    useState('');

  const [dateOfBirth, setDateOfBirth] =
    useState<Date | null>(null);

  const [bio, setBio] = useState('');

  const [error, setError] =
    useState('');

  const [
    showCountryPicker,
    setShowCountryPicker,
  ] = useState(false);

  const [
    showLanguagePicker,
    setShowLanguagePicker,
  ] = useState(false);

  const [
    showGenderPicker,
    setShowGenderPicker,
  ] = useState(false);

  const [
    showDatePicker,
    setShowDatePicker,
  ] = useState(false);

  const age = dateOfBirth
    ? calculateAge(dateOfBirth)
    : null;

  const ageBracket =
    age !== null
      ? getAgeBracket(age)
      : '';

  const handleNativeDateChange = (
    event: { type: string },
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (
      event.type === 'dismissed' ||
      !selectedDate
    ) {
      return;
    }

    setDateOfBirth(selectedDate);
    setError('');

    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
    }
  };

  const handleWebDateChange = (
    selectedDate: Date,
  ) => {
    setDateOfBirth(selectedDate);
    setError('');
    setShowDatePicker(false);
  };

  const handleContinue = () => {
    setError('');

    if (!displayName || !username) {
      setError(
        'Identity information is missing. Please go back.',
      );
      return;
    }

    if (!country) {
      setError(
        'Please select your country.',
      );
      return;
    }

    if (!language) {
      setError(
        'Please select your language.',
      );
      return;
    }

    if (!gender) {
      setError(
        'Please select your gender.',
      );
      return;
    }

    if (!dateOfBirth) {
      setError(
        'Please select your date of birth.',
      );
      return;
    }

    if (
      age === null ||
      age < 13
    ) {
      setError(
        'You must be at least 13 years old to use DareShot.',
      );
      return;
    }

    if (!ageBracket) {
      setError(
        'Could not determine your age bracket.',
      );
      return;
    }

    router.push({
      pathname:
        '/(onboarding)/interests',
      params: {
        displayName,
        username,
        country,
        language,
        gender,
        dateOfBirth:
          formatDateForInput(
            dateOfBirth,
          ),
        ageBracket,
        bio: bio.trim(),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <Text style={styles.step}>
          02 / 05
        </Text>

        <View style={styles.header}>
          <Text style={styles.title}>
            A little more about you.
          </Text>

          <Text style={styles.subtitle}>
            This helps DareShot understand your
            profile and keep future dare
            experiences age-appropriate.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Country */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Country
            </Text>

            <Pressable
              style={styles.select}
              onPress={() => {
                setShowCountryPicker(
                  !showCountryPicker,
                );
                setShowLanguagePicker(false);
                setShowGenderPicker(false);
                setShowDatePicker(false);
              }}
            >
              <Text
                style={[
                  styles.selectText,
                  !country &&
                    styles.placeholderText,
                ]}
              >
                {country ||
                  'Select your country'}
              </Text>

              <Text style={styles.chevron}>
                {showCountryPicker
                  ? '⌃'
                  : '⌄'}
              </Text>
            </Pressable>

            {showCountryPicker ? (
              <View style={styles.options}>
                {COUNTRIES.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.option}
                    onPress={() => {
                      setCountry(item);
                      setShowCountryPicker(
                        false,
                      );
                      setError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        country === item &&
                          styles.selectedOptionText,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Language */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Language
            </Text>

            <Pressable
              style={styles.select}
              onPress={() => {
                setShowLanguagePicker(
                  !showLanguagePicker,
                );
                setShowCountryPicker(false);
                setShowGenderPicker(false);
                setShowDatePicker(false);
              }}
            >
              <Text
                style={[
                  styles.selectText,
                  !language &&
                    styles.placeholderText,
                ]}
              >
                {language ||
                  'Select your language'}
              </Text>

              <Text style={styles.chevron}>
                {showLanguagePicker
                  ? '⌃'
                  : '⌄'}
              </Text>
            </Pressable>

            {showLanguagePicker ? (
              <View style={styles.options}>
                {LANGUAGES.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.option}
                    onPress={() => {
                      setLanguage(item);
                      setShowLanguagePicker(
                        false,
                      );
                      setError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        language === item &&
                          styles.selectedOptionText,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Gender
            </Text>

            <Pressable
              style={styles.select}
              onPress={() => {
                setShowGenderPicker(
                  !showGenderPicker,
                );
                setShowCountryPicker(false);
                setShowLanguagePicker(false);
                setShowDatePicker(false);
              }}
            >
              <Text
                style={[
                  styles.selectText,
                  !gender &&
                    styles.placeholderText,
                ]}
              >
                {gender ||
                  'Select your gender'}
              </Text>

              <Text style={styles.chevron}>
                {showGenderPicker
                  ? '⌃'
                  : '⌄'}
              </Text>
            </Pressable>

            {showGenderPicker ? (
              <View style={styles.options}>
                {GENDERS.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.option}
                    onPress={() => {
                      setGender(item);
                      setShowGenderPicker(
                        false,
                      );
                      setError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        gender === item &&
                          styles.selectedOptionText,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Date of Birth */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Date of birth
            </Text>

            {Platform.OS === 'web' ? (
              <WebDateInput
                value={dateOfBirth}
                onChange={
                  handleWebDateChange
                }
                minimumDate={
                  getMinimumDateInput()
                }
                maximumDate={
                  getTodayDateInput()
                }
              />
            ) : (
              <>
                <Pressable
                  style={styles.select}
                  onPress={() => {
                    setShowDatePicker(
                      !showDatePicker,
                    );
                    setShowCountryPicker(
                      false,
                    );
                    setShowLanguagePicker(
                      false,
                    );
                    setShowGenderPicker(
                      false,
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !dateOfBirth &&
                        styles.placeholderText,
                    ]}
                  >
                    {dateOfBirth
                      ? formatDate(
                          dateOfBirth,
                        )
                      : 'Select your date of birth'}
                  </Text>

                  <Text
                    style={styles.calendarIcon}
                  >
                    ▣
                  </Text>
                </Pressable>

                {showDatePicker ? (
                  <DateTimePicker
                    value={
                      dateOfBirth ??
                      new Date(
                        2000,
                        0,
                        1,
                      )
                    }
                    mode="date"
                    display={
                      Platform.OS ===
                      'ios'
                        ? 'spinner'
                        : 'default'
                    }
                    maximumDate={
                      new Date()
                    }
                    minimumDate={
                      new Date(
                        1940,
                        0,
                        1,
                      )
                    }
                    onChange={
                      handleNativeDateChange
                    }
                  />
                ) : null}
              </>
            )}

            {dateOfBirth ? (
              <Text
                style={styles.selectedDateText}
              >
                {formatDate(dateOfBirth)}
              </Text>
            ) : null}

            {age !== null ? (
              <Text style={styles.ageHint}>
                Age: {age} · Age bracket:{' '}
                {ageBracket}
              </Text>
            ) : null}
          </View>

          <Input
            label="Bio"
            placeholder="Tell people a little about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={160}
            style={styles.bioInput}
          />

          <Text
            style={styles.characterCount}
          >
            {bio.length}/160
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label="CONTINUE"
            onPress={handleContinue}
          />

          <Text style={styles.footerHint}>
            You can update your profile details
            later.
          </Text>

          <Text
            style={styles.backButton}
            onPress={() => router.back()}
          >
            Back
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  progressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },

  step: {
    marginTop: spacing.lg,
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },

  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },

  title: {
    color: colors.primaryText,
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xxl,
    lineHeight: 38,
  },

  subtitle: {
    marginTop: spacing.sm,
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 24,
  },

  form: {
    gap: spacing.md,
  },

  field: {
    gap: spacing.xs,
  },

  label: {
    color: colors.primaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  select: {
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectText: {
    flex: 1,
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
  },

  placeholderText: {
    color: colors.secondaryText,
  },

  chevron: {
    color: colors.secondaryText,
    fontSize: 20,
    marginLeft: spacing.sm,
  },

  calendarIcon: {
    color: colors.accent,
    fontSize: 18,
    marginLeft: spacing.sm,
  },

  options: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  optionText: {
    color: colors.primaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
  },

  selectedOptionText: {
    color: colors.accent,
    fontFamily: fontFamily.bodyMedium,
  },

  selectedDateText: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  ageHint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  bioInput: {
    minHeight: 120,
  },

  characterCount: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'right',
    marginTop: -spacing.sm,
  },

  errorBox: {
    backgroundColor: '#241519',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },

  footerHint: {
    color: colors.secondaryText,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  backButton: {
    color: colors.secondaryText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});