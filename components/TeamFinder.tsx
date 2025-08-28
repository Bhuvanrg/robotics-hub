import React, { useState } from 'react';
import { Users, MapPin, Code, Wrench, Zap, User, Plus, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useUserPreferences } from './UserPreferencesContext';

// Mock data for team finder
const mockStudentsLookingForTeams = [
  {
    id: 1,
    name: 'Jordan Smith',
    location: 'Seattle, WA',
    skills: ['Programming', 'Java', 'Python'],
    experience: '2 years FRC',
    description:
      'Looking to join a competitive FRC team. Strong in autonomous programming and vision processing.',
    contactInfo: 'jordan.smith@email.com',
  },
  {
    id: 2,
    name: 'Maya Patel',
    location: 'Portland, OR',
    skills: ['CAD', 'Mechanical Design', '3D Printing'],
    experience: '1 year FTC',
    description:
      'Experienced in mechanical design and fabrication. Want to join an FRC team for next season.',
    contactInfo: 'maya.p@email.com',
  },
  {
    id: 3,
    name: 'Alex Chen',
    location: 'Vancouver, BC',
    skills: ['Electronics', 'Wiring', 'Sensors'],
    experience: '3 years VEX',
    description:
      'Electronics specialist looking to transition to FRC. Expert in sensor integration and troubleshooting.',
    contactInfo: 'alexchen@email.com',
  },
];

const mockTeamsLookingForMembers = [
  {
    id: 1,
    teamName: 'Circuit Breakers FRC 5432',
    location: 'Bellevue, WA',
    rolesNeeded: ['Driver', 'Mechanical Engineer'],
    teamSize: 18,
    experience: '10+ years competitive FRC',
    description:
      'Established team seeking a skilled driver and mechanical engineer for the upcoming season. We emphasize both competition excellence and STEM outreach.',
    contactInfo: 'recruitment@circuitbreakers.org',
    meetingTime: 'Saturdays 10am-4pm',
  },
  {
    id: 2,
    teamName: 'Code Crusaders FTC 9876',
    location: 'Tacoma, WA',
    rolesNeeded: ['Programmer', 'CAD Designer'],
    teamSize: 12,
    experience: '5 years FTC',
    description:
      'Growing FTC team looking for passionate programmers and CAD designers. Great learning environment for developing skills.',
    contactInfo: 'team@codecrusaders.tech',
    meetingTime: 'Weekdays 4-6pm',
  },
  {
    id: 3,
    teamName: 'Voltage Vipers FRC 7890',
    location: 'Spokane, WA',
    rolesNeeded: ['Mentor', 'Electronics Specialist'],
    teamSize: 20,
    experience: '8 years FRC',
    description:
      'Looking for an experienced mentor and electronics specialist to join our team. We compete at the highest level while maintaining a fun learning environment.',
    contactInfo: 'mentors@voltagevipers.com',
    meetingTime: 'Mon/Wed/Fri 3:30-6pm',
  },
];

const skillIcons = {
  Programming: Code,
  Java: Code,
  Python: Code,
  CAD: Wrench,
  'Mechanical Design': Wrench,
  '3D Printing': Wrench,
  Electronics: Zap,
  Wiring: Zap,
  Sensors: Zap,
  Driver: User,
  'Mechanical Engineer': Wrench,
  Programmer: Code,
  'CAD Designer': Wrench,
  Mentor: User,
  'Electronics Specialist': Zap,
};

interface TeamFinderProps {
  user?: { name?: string };
}
export function TeamFinder({ user }: TeamFinderProps) {
  const [activeTab, setActiveTab] = useState('students');
  const [showCreateListing, setShowCreateListing] = useState(false);
  const { preferences } = useUserPreferences();

  type SkillIconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;
  const getSkillIcon = (skill: string): SkillIconType => {
    const Icon = (skillIcons as Record<string, SkillIconType>)[skill] || User;
    return Icon;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3>Team Finder</h3>
          <p className="text-sm text-muted-foreground">
            Connect with teams and students in your area
          </p>
        </div>
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => setShowCreateListing(true)}
        >
          <Plus className="mr-1 size-4" />
          Add Listing
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students">Looking for Teams</TabsTrigger>
          <TabsTrigger value="teams">Teams Recruiting</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4 space-y-4">
          {/* Example: include current user listing if opted-in */}
          {preferences.showInTeamFinder && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-teal-100 text-teal-600">
                        {(user?.name || 'You')
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{user?.name || 'You'}</h4>
                      {preferences.location && (
                        <p className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="mr-1 size-3" />
                          {preferences.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Your Listing
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {preferences.bio || 'Add a bio in your profile to enhance your listing.'}
                </p>
                {preferences.interests.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {preferences.interests.map((skill) => (
                      <Badge key={skill} variant="secondary" className="flex items-center text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  (Only visible while &quot;Show in Team Finder&quot; is enabled)
                </p>
              </CardContent>
            </Card>
          )}
          {mockStudentsLookingForTeams
            .filter(() => true)
            .map((student) => (
              <Card key={student.id}>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-teal-100 text-teal-600">
                          {student.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{student.name}</h4>
                        <p className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="mr-1 size-3" />
                          {student.location}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {student.experience}
                    </Badge>
                  </div>

                  <p className="mb-3 text-sm text-muted-foreground">{student.description}</p>

                  {/* Skills */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {student.skills.map((skill) => {
                      const Icon = getSkillIcon(skill);
                      return (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="flex items-center text-xs"
                        >
                          <Icon className="mr-1 size-3" />
                          {skill}
                        </Badge>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Contact: {student.contactInfo}</p>
                    <Button size="sm" variant="outline" className="text-teal-600">
                      <MessageCircle className="mr-1 size-4" />
                      Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="teams" className="mt-4 space-y-4">
          {mockTeamsLookingForMembers.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{team.teamName}</h4>
                    <p className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-1 size-3" />
                      {team.location}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {team.teamSize} members • {team.experience}
                    </p>
                  </div>
                  <Badge className="text-xs bg-green-100 text-green-800">Recruiting</Badge>
                </div>

                <p className="mb-3 text-sm text-muted-foreground">{team.description}</p>

                {/* Roles Needed */}
                <div className="mb-3">
                  <p className="mb-2 text-xs font-medium text-gray-700">Roles Needed:</p>
                  <div className="flex flex-wrap gap-2">
                    {team.rolesNeeded.map((role) => {
                      const Icon = getSkillIcon(role);
                      return (
                        <Badge
                          key={role}
                          className="flex items-center text-xs bg-orange-100 text-orange-800"
                        >
                          <Icon className="mr-1 size-3" />
                          {role}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Meeting Info */}
                <div className="mb-3 rounded bg-gray-50 p-2 text-xs">
                  <p>
                    <strong>Meeting Schedule:</strong> {team.meetingTime}
                  </p>
                  <p>
                    <strong>Contact:</strong> {team.contactInfo}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                    <MessageCircle className="mr-1 size-4" />
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create Listing Modal Placeholder */}
      {showCreateListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md overflow-y-auto max-h-[80vh]">
            <CardHeader>
              <h3>Create Team Finder Listing</h3>
              <p className="text-sm text-muted-foreground">
                Choose whether you&apos;re looking for a team or recruiting members
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="flex h-20 flex-col items-center justify-center"
                >
                  <User className="mb-1 size-6" />
                  <span className="text-xs">Looking for Team</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex h-20 flex-col items-center justify-center"
                >
                  <Users className="mb-1 size-6" />
                  <span className="text-xs">Team Recruiting</span>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateListing(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700">Continue</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
