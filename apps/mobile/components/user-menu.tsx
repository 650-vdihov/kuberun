import React, { useState } from "react";
import {
    View,
    TouchableOpacity,
    Image,
    Modal,
    StyleSheet,
    Pressable,
    Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { User, Users, LogOut, X } from "lucide-react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/contexts/auth-context";

export function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const colorScheme = useColorScheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colors = Colors[colorScheme ?? "light"];
    const { user, signOut } = useAuth();
    
    // Use auth user data with fallback for avatar
    // user.image comes from better-auth User type
    const displayUser = {
        name: user?.name ?? "User",
        email: user?.email ?? "",
        image: user?.image ?? 'https://i.pravatar.cc/150?img=1',
    };

    const handleNavigate = (route: string) => {
        setIsOpen(false);
        router.push(route as any);
    };

    const handleSignOut = async () => {
        setIsOpen(false);
        await signOut();
    };

    return (
        <>
            {/* Avatar Button */}
            <TouchableOpacity
                style={[styles.avatarButton, { borderColor: colors.tint }]}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                {displayUser.image ? (
                    <Image source={{ uri: displayUser.image }} style={styles.avatarImage} />
                ) : (
                    <View
                        style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}
                    >
                        <User size={20} color={colors.background} />
                    </View>
                )}
            </TouchableOpacity>

            {/* Full Screen Overlay Menu */}
            <Modal
                visible={isOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsOpen(false)}
            >
                <View
                    style={[
                        styles.overlay,
                        { backgroundColor: colors.background, paddingTop: insets.top },
                    ]}
                >
                    {/* Close Button - positioned same as avatar button */}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setIsOpen(false)}
                        activeOpacity={0.7}
                    >
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>

                    {/* User Avatar in Menu */}
                    <View style={styles.menuHeader}>
                        {displayUser.image ? (
                            <Image source={{ uri: displayUser.image }} style={styles.menuAvatar} />
                        ) : (
                            <View
                                style={[
                                    styles.menuAvatarPlaceholder,
                                    { backgroundColor: colors.tint },
                                ]}
                            >
                                <User size={48} color={colors.background} />
                            </View>
                        )}
                        {displayUser.name && (
                            <Text style={[styles.userName, { color: colors.text }]}>
                                {displayUser.name}
                            </Text>
                        )}
                    </View>

                    {/* Menu Options */}
                    <View style={styles.menuOptions}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.menuItem,
                                {
                                    backgroundColor: pressed ? colors.icon + "20" : "transparent",
                                },
                            ]}
                            onPress={() => handleNavigate("/profile")}
                        >
                            <User size={24} color={colors.text} />
                            <Text style={[styles.menuItemText, { color: colors.text }]}>
                                Profile
                            </Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.menuItem,
                                {
                                    backgroundColor: pressed ? colors.icon + "20" : "transparent",
                                },
                            ]}
                            onPress={() => handleNavigate("/clubs")}
                        >
                            <Users size={24} color={colors.text} />
                            <Text style={[styles.menuItemText, { color: colors.text }]}>
                                Clubs
                            </Text>
                        </Pressable>
                    </View>

                    {/* Sign Out Button at Bottom */}
                    <View style={styles.logoutContainer}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.logoutButton,
                                {
                                    backgroundColor: pressed ? "#dc262620" : "transparent",
                                    borderColor: "#dc2626",
                                },
                            ]}
                            onPress={handleSignOut}
                        >
                            <LogOut size={24} color="#dc2626" />
                            <Text style={styles.logoutText}>Sign Out</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    avatarButton: {
        position: "absolute",
        top: 8,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        overflow: "hidden",
        zIndex: 100,
    },
    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    overlay: {
        flex: 1,
        paddingHorizontal: 24,
    },
    closeButton: {
        position: "absolute",
        top: 8,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    menuHeader: {
        alignItems: "center",
        marginTop: 40,
        marginBottom: 48,
    },
    userName: {
        fontSize: 20,
        fontWeight: "600",
        marginTop: 12,
    },
    menuAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    menuAvatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    menuOptions: {
        gap: 8,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    menuItemText: {
        fontSize: 18,
        fontWeight: "500",
    },
    logoutContainer: {
        position: "absolute",
        bottom: 48,
        left: 24,
        right: 24,
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    logoutText: {
        fontSize: 18,
        fontWeight: "500",
        color: "#dc2626",
    },
});
