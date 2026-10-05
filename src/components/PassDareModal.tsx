import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export type PassDarePerson = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

type PassDareModalProps = {
  visible: boolean;
  people: PassDarePerson[];
  search: string;
  loading?: boolean;
  submitting?: boolean;
  selectedUserId: string | null;
  onSearchChange: (value: string) => void;
  onSelect: (userId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export default function PassDareModal({
  visible,
  people,
  search,
  loading = false,
  submitting = false,
  selectedUserId,
  onSearchChange,
  onSelect,
  onConfirm,
  onClose,
}: PassDareModalProps) {
  const filteredPeople = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return people;
    }

    return people.filter((person) => {
      const displayName = person.displayName.toLowerCase();
      const username = (person.username ?? '').toLowerCase();

      return (
        displayName.includes(normalizedSearch) ||
        username.includes(normalizedSearch)
      );
    });
  }, [people, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!submitting) {
              onClose();
            }
          }}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Pass This Dare</Text>
              <Text style={styles.subtitle}>
                Choose someone to continue the Dare Chain.
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={submitting}
              hitSlop={10}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={22}
                color="#111111"
              />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={18}
              color="#777777"
            />

            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search friends or followers"
              placeholderTextColor="#8A8A8A"
              editable={!submitting}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.chainInfo}>
            <Ionicons
              name="git-branch-outline"
              size={18}
              color="#111111"
            />

            <Text style={styles.chainInfoText}>
              You → Next Player → Next Player
            </Text>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator
                size="small"
                color="#111111"
              />

              <Text style={styles.stateText}>
                Loading people...
              </Text>
            </View>
          ) : filteredPeople.length === 0 ? (
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="people-outline"
                  size={24}
                  color="#555555"
                />
              </View>

              <Text style={styles.emptyTitle}>
                No people found
              </Text>

              <Text style={styles.emptyText}>
                Follow someone or connect with them before passing this Dare.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredPeople}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const selected = item.id === selectedUserId;

                return (
                  <Pressable
                    onPress={() => onSelect(item.id)}
                    disabled={submitting}
                    style={[
                      styles.personRow,
                      selected && styles.personRowSelected,
                    ]}
                  >
                    {item.avatarUrl ? (
                      <Image
                        source={{ uri: item.avatarUrl }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {item.displayName
                            .trim()
                            .charAt(0)
                            .toUpperCase() || 'D'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.personInfo}>
                      <Text
                        numberOfLines={1}
                        style={styles.personName}
                      >
                        {item.displayName}
                      </Text>

                      {item.username ? (
                        <Text
                          numberOfLines={1}
                          style={styles.username}
                        >
                          @{item.username}
                        </Text>
                      ) : (
                        <Text style={styles.username}>
                          Dareshot user
                        </Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.radio,
                        selected && styles.radioSelected,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color="#FFFFFF"
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          <View style={styles.footer}>
            <Pressable
              onPress={onConfirm}
              disabled={!selectedUserId || submitting}
              style={[
                styles.confirmButton,
                (!selectedUserId || submitting) &&
                  styles.confirmButtonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.confirmText}>
                    Pass Dare
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },

  sheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },

  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D0D0D0',
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#666666',
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },

  searchBox: {
    height: 46,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchInput: {
    flex: 1,
    marginLeft: 9,
    fontSize: 14,
    color: '#111111',
    paddingVertical: 0,
  },

  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },

  chainInfoText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },

  listContent: {
    paddingTop: 10,
    paddingBottom: 8,
  },

  personRow: {
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  personRowSelected: {
    backgroundColor: '#F1F1F1',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E9E9E9',
  },

  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E9E9E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#555555',
  },

  personInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  personName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },

  username: {
    marginTop: 3,
    fontSize: 12,
    color: '#777777',
  },

  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  centerState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  stateText: {
    marginTop: 10,
    fontSize: 13,
    color: '#666666',
  },

  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#222222',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#777777',
  },

  footer: {
    paddingTop: 10,
  },

  confirmButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  confirmButtonDisabled: {
    opacity: 0.4,
  },

  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});