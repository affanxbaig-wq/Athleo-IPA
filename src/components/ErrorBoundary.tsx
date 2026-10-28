import React, {Component, ReactNode} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {ATHLEO_COLORS} from '../theme/theme';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('[ErrorBoundary] Caught render error safely:', error, errorInfo);
  }

  resetError = () => {
    this.setState({hasError: false, error: null});
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('[ErrorBoundary] onReset handler error:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🛡️</Text>
            </View>
            <Text style={styles.title}>Athleo Auto-Recovery</Text>
            <Text style={styles.message}>
              {this.state.error?.message
                ? `An issue was safely contained: ${this.state.error.message}`
                : 'A view encountered an issue, but Athleo kept your session safe.'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.resetError} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Restore App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(184,255,77,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.3)',
  },
  iconEmoji: {
    fontSize: 28,
  },
  title: {
    color: ATHLEO_COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: ATHLEO_COLORS.muted,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonText: {
    color: ATHLEO_COLORS.background,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
